import mongoose from 'mongoose'
const collection = 'grant_payments'

const BusinessIdentifier = new mongoose.Schema({
  sbi: { type: String, required: true },
  frn: { type: String, required: true },
  claimId: { type: String, required: true }
})

const Payment = new mongoose.Schema({
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  accountCode: { type: String, required: true },
  fundCode: { type: String, required: true },
  schemaCode: { type: String, required: true },
  dueDate: { type: String, required: true },
  status: {
    type: String,
    required: true,
    default: 'pending',
    enum: ['pending', 'cancelled', 'submitted']
  }
})

const Grant = new mongoose.Schema({
  paymentRequestNumber: { type: Number, required: true },
  correlationId: { type: String, required: true },
  invoiceNumber: { type: String, required: true },
  originalInvoiceNumber: { type: String, required: true },
  agreementNumber: { type: String, required: true },
  dueDate: { type: String },
  recoveryDate: { type: String },
  originalSettlementDate: { type: String },
  remittanceDescription: { type: String },
  totalAmount: { type: Number, required: true },
  currency: { type: String, required: true },
  marketingYear: { type: String, required: true },
  payments: [{ type: Payment, required: true }]
})

const schema = new mongoose.Schema(
  {
    businessIdentifier: { type: BusinessIdentifier, required: true },
    grants: [{ type: Grant, required: true }]
  },
  { collection, timestamps: true }
)

export default mongoose.model(collection, schema)
