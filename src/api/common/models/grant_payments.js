import mongoose from 'mongoose'
const collection = 'grant_payments'

const { Decimal128 } = mongoose.Types

const InvoiceLine = new mongoose.Schema({
  schemeCode: { type: String, required: true },
  description: { type: String, required: true },
  amountPence: { type: Decimal128, required: true },
  accountCode: { type: String, required: true },
  fundCode: { type: String, required: true },
  deliveryBody: { type: String, required: true }
})

const Payment = new mongoose.Schema({
  dueDate: { type: String, required: true },
  totalAmountPence: { type: Decimal128, required: true },
  invoiceLines: [{ type: InvoiceLine, required: true }],
  status: {
    type: String,
    required: true,
    default: 'pending',
    enum: ['pending', 'locked', 'cancelled', 'submitted', 'failed']
  }
})

const Grant = new mongoose.Schema({
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
})

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
schema.index({ _id: 1 })
schema.index({ sbi: 1 })
schema.index({ frn: 1 })
schema.index({ 'grants.payments.dueDate': 1 })
schema.index({ 'grants.payments.status': 1 })
schema.index({ 'grants.payments.invoiceLines.fundCode': 1 })

// Compound indexes — ordered to match filter + sort patterns used in queries
// fetchGrantPaymentsBySbi: filter on sbi, sort by createdAt
schema.index({ sbi: 1, createdAt: -1 })
// fetchGrantPaymentsBySbiAndFundCode: filter on sbi + fundCode (fundCode alone is never queried)
schema.index({ sbi: 1, 'grants.payments.invoiceLines.fundCode': 1 })
// cancelGrantPayments: filter on { sbi, frn }
schema.index({ sbi: 1, frn: 1 })
// fetchGrantPaymentsByDate (daily cron): filter on dueDate + status, sort by createdAt
schema.index({
  'grants.payments.dueDate': 1,
  'grants.payments.status': 1,
  createdAt: -1
})

export default mongoose.model(collection, schema)
