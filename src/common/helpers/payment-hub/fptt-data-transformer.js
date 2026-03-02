import { formatPaymentDate } from '#~/common/helpers/format-payment-date.js'

const DEBT_TYPE_MAX_LENGTH = 3
const deliveryBody = 'RP00'

export const validateDebtType = (debtType) => {
  if (debtType.length > DEBT_TYPE_MAX_LENGTH) {
    throw new Error(
      `value of ${debtType} must be no more than ${DEBT_TYPE_MAX_LENGTH} characters`
    )
  }
  return debtType
}

const REMITTANCE_DESCRIPTION_MAX_LENGTH = 60

export const validateRemittanceDescription = (remittanceDescription) => {
  if (remittanceDescription.length > REMITTANCE_DESCRIPTION_MAX_LENGTH) {
    throw new Error(
      `value of ${remittanceDescription} must be no more than ${REMITTANCE_DESCRIPTION_MAX_LENGTH} characters`
    )
  }
  return remittanceDescription
}

const buildInvoiceLines = (grant, payment) =>
  payment.invoiceLines.map((invoiceLine) => ({
    schemeCode: invoiceLine.schemeCode,
    accountCode: grant.accountCode || 'SOS710',
    fundCode: grant.fundCode || 'DRD10',
    agreementNumber: grant.agreementNumber,
    description: invoiceLine.description,
    value: invoiceLine.amount,
    deliveryBody,
    marketingYear: grant.marketingYear
  }))

/**
 * Transforms SFI payment data into the format required by Payment Hub
 * @param {schema} identifiers
 * @param {Grant} grant
 * @param {Payment} payment
 * @returns {PaymentHubRequest}
 */
export const transformFpttPaymentDataToPaymentHubFormat = (
  identifiers,
  grant,
  payment
) => ({
  sourceSystem: 'FPTT', // Farm Payments Technical Test
  ledger: 'AP',
  deliveryBody,
  invoiceNumber: grant.invoiceNumber,
  frn: identifiers.frn,
  sbi: identifiers.sbi,
  fesCode: 'FALS_FPTT',
  marketingYear: grant.marketingYear || new Date().getFullYear(),
  paymentRequestNumber: grant.paymentRequestNumber,
  agreementNumber: grant.agreementNumber,
  contractNumber: identifiers.claimId,
  currency: payment.currency || 'GBP',
  dueDate: formatPaymentDate(payment.dueDate),
  remittanceDescription: validateRemittanceDescription(
    'Farm Payments Technical Test Payment'
  ),
  invoiceLines: buildInvoiceLines(grant, payment),

  // Not listed in Service Bus Payment Requests - FPTT.xlsx
  correlationId: grant.correlationId,

  // AR fields — only included when valid data is present
  ...(grant.debtType && { debtType: validateDebtType(grant.debtType) }),
  ...(payment.recoveryDate && {
    recoveryDate: formatPaymentDate(payment.recoveryDate)
  }),
  ...(grant.originalInvoiceNumber && {
    originalInvoiceNumber: grant.originalInvoiceNumber
  }),
  ...(payment.originalSettlementDate && {
    originalSettlementDate: formatPaymentDate(payment.originalSettlementDate)
  }),
  ...(grant.totalAmount != null && { value: grant.totalAmount })
})

/** @import { schema, Grant, Payment } from '#~/api/common/grant_payments.js' */
/** @import { PaymentHubRequest } from '#~/common/types/payment-hub.d.js' */
