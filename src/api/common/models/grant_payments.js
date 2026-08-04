import mongoose from 'mongoose'
const collection = 'grant_payments'

const { Decimal128 } = mongoose.Types

/**
 * @typedef {object} InvoiceLine
 * @property {import('mongoose').Types.ObjectId} _id - The invoice line id
 * @property {string} schemeCode - The scheme code
 * @property {string} description - The line description
 * @property {unknown} amountPence - The amount in pence
 * @property {string} accountCode - The account code
 * @property {string} fundCode - The fund code
 * @property {string} deliveryBody - The delivery body
 */

/**
 * @typedef {object} Payment
 * @property {import('mongoose').Types.ObjectId} _id - The payment id
 * @property {string} dueDate - The payment due date
 * @property {unknown} totalAmountPence - The total amount in pence
 * @property {string} correlationId - The payment correlation id
 * @property {Array<InvoiceLine>} invoiceLines - The invoice lines
 * @property {string} status - The payment status
 * @property {string | null} [currency] - The payment currency
 * @property {string | null} [recoveryDate] - The recovery date
 * @property {string | null} [originalSettlementDate] - The original settlement date
 */

/**
 * @typedef {object} Grant
 * @property {import('mongoose').Types.ObjectId} _id - The grant id
 * @property {string} sourceSystem - The source system
 * @property {number} paymentRequestNumber - The payment request number
 * @property {string} correlationId - The grant correlation id
 * @property {string} invoiceNumber - The invoice number
 * @property {string | null} [originalInvoiceNumber] - The original invoice number
 * @property {string} agreementNumber - The agreement number
 * @property {string | null} [recoveryDate] - The recovery date
 * @property {string | null} [originalSettlementDate] - The original settlement date
 * @property {string | null} [remittanceDescription] - The remittance description
 * @property {unknown} totalAmountPence - The total amount in pence
 * @property {string} currency - The currency
 * @property {string | null} [marketingYear] - The marketing year
 * @property {string} ledger - The ledger
 * @property {string} fesCode - The FES code
 * @property {string} deliveryBody - The delivery body
 * @property {Array<Payment>} payments - The payments
 * @property {Array<Payment>} [matchedPayments] - The matched payments
 * @property {string} [debtType] - The debt type
 */

const InvoiceLine = new mongoose.Schema({
  schemeCode: { type: String, required: true },
  description: { type: String, required: true },
  amountPence: { type: Decimal128, required: true },
  accountCode: { type: String, required: true },
  fundCode: { type: String, required: true },
  deliveryBody: { type: String, required: true }
})

const Payment = new mongoose.Schema(
  {
    dueDate: { type: String, required: true },
    totalAmountPence: { type: Decimal128, required: true },
    correlationId: { type: String, required: true },
    invoiceLines: [{ type: InvoiceLine, required: true }],
    status: {
      type: String,
      required: true,
      default: 'pending',
      enum: ['pending', 'locked', 'cancelled', 'submitted', 'failed']
    }
  },
  { timestamps: true }
)

const Grant = new mongoose.Schema(
  {
    sourceSystem: { type: String, required: true },
    paymentRequestNumber: { type: Number, required: true },
    correlationId: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
    originalInvoiceNumber: { type: String },
    agreementNumber: { type: String, required: true },
    recoveryDate: { type: String },
    originalSettlementDate: { type: String },
    remittanceDescription: { type: String },
    totalAmountPence: { type: Decimal128, required: true },
    currency: { type: String, required: true },
    marketingYear: { type: String },
    ledger: { type: String, required: true },
    fesCode: { type: String, required: true },
    deliveryBody: { type: String, required: true },
    payments: [{ type: Payment, required: true }]
  },
  { timestamps: true }
)

const schema = new mongoose.Schema(
  {
    sbi: { type: String, required: true },
    frn: { type: String, required: true },
    claimId: { type: String, required: true },
    grants: [{ type: Grant, required: true }]
  },
  { collection, timestamps: true }
)

// Single-field indexes
schema.index({ sbi: 1 })
schema.index({ frn: 1 })
schema.index({ 'grants.correlationId': 1 }, { unique: true })
schema.index({ 'grants.payments.correlationId': 1 }, { unique: true })
schema.index({ 'grants.payments.dueDate': 1 })
schema.index({ 'grants.payments.status': 1 })
schema.index({ 'grants.payments.invoiceLines.schemeCode': 1 })
schema.index({ 'grants.payments.invoiceLines.fundCode': 1 })

// Compound indexes — ordered to match filter + sort patterns used in queries
// fetchGrantPaymentsBySbi: filter on sbi, sort by createdAt
schema.index({ sbi: 1, createdAt: -1 })
// fetchGrantPaymentsBySbiAndFundCode: filter on sbi + fundCode (fundCode alone is never queried)
schema.index({ sbi: 1, 'grants.payments.invoiceLines.fundCode': 1 })
// cancelGrantPayments: filter on { sbi, frn }
schema.index({ sbi: 1, frn: 1 })
// fetchGrantPaymentsByDate (daily cron): filter on dueDate + status
schema.index({
  'grants.payments.dueDate': 1,
  'grants.payments.status': 1
})

export default mongoose.model(collection, schema)
