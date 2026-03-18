import mongoose from 'mongoose'
const collection = 'grant_payments'

const { Decimal128 } = mongoose.Types

const InvoiceLine = new mongoose.Schema({
  schemeCode: { type: String, required: true },
  description: { type: String, required: true },
  amountPence: { type: Decimal128, required: true },
  accountCode: { type: String },
  fundCode: { type: String },
  deliveryBody: { type: String },
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
  ledger: { type: String },
  fesCode: { type: String },
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

export default mongoose.model(collection, schema)
