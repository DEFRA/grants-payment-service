import mongoose from 'mongoose'
const collection = 'grant_payments'

const { Decimal128 } = mongoose.Types

const InvoiceLine = new mongoose.Schema({
  schemeCode: { type: String, required: true },
  accountCode: { type: String },
  fundCode: { type: String },
  description: { type: String, required: true },
  amount: { type: Decimal128, required: true }
})

const Payment = new mongoose.Schema({
  dueDate: { type: String, required: true },
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
  originalInvoiceNumber: { type: String, required: true },
  agreementNumber: { type: String, required: true },
  dueDate: { type: String },
  recoveryDate: { type: String },
  originalSettlementDate: { type: String },
  remittanceDescription: { type: String },
  totalAmount: { type: Decimal128, required: true },
  currency: { type: String, required: true },
  marketingYear: { type: String },
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
