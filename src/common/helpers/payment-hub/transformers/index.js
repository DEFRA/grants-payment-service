import * as transformers from './schemes/index.js'
import { formatPaymentDate } from '#~/common/helpers/format-payment-date.js'
import { getActionCodeByName } from '#~/common/helpers/config-mapper/index.js'

const DEBT_TYPE_MAX_LENGTH = 3

const asNumbersOnly = (value) => value.replaceAll(/\D/g, '')

const valueFormatter = new Intl.NumberFormat('en-GB', {
  useGrouping: false,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const validateDebtType = (debtType) => {
  if (debtType.length > DEBT_TYPE_MAX_LENGTH) {
    throw new Error(
      `value of ${debtType} must be no more than ${DEBT_TYPE_MAX_LENGTH} characters`
    )
  }
  return debtType
}

const buildInvoiceLines = (grant, payment) =>
  payment.invoiceLines.map((invoiceLine) => ({
    schemeCode: getActionCodeByName(invoiceLine.schemeCode),
    accountCode: invoiceLine.accountCode,
    fundCode: invoiceLine.fundCode,
    agreementNumber: asNumbersOnly(grant.agreementNumber),
    description: 'G00 - Gross Value of Claim',
    value: valueFormatter.format(Number(invoiceLine.amountPence) / 100),
    deliveryBody: invoiceLine.deliveryBody,
    marketingYear: grant.marketingYear
  }))

const paymentId = (id) => id?.toString?.() ?? ''

/**
 * Calculates the quarter suffix for an invoice number based on the payment index
 * @param {string} invoiceNumber
 * @param {Array} payments - Array of all payments for the grant
 * @param {Object} currentPayment - The current payment object with _id (from MongoDB)
 * @returns string
 */
const updateQuarter = (invoiceNumber, payments, currentPayment) => {
  const invoiceWithoutQuarter = invoiceNumber.replace(/Q[1-4X]$/i, '')
  const currentPaymentId = paymentId(currentPayment?._id)

  if (!currentPaymentId) {
    throw new Error('Payment _id is required for quarter calculation')
  }

  const paymentIndex = (payments || []).findIndex(
    (p) => paymentId(p._id) === currentPaymentId
  )

  if (paymentIndex === -1) {
    throw new Error('Payment not found in the payments array')
  }

  return `${invoiceWithoutQuarter}Q${paymentIndex + 1}`
}

/**
 * Transforms data into the format required by Payment Hub
 * @param {schema} identifiers
 * @param {Grant} grant
 * @param {Payment} payment
 * @returns {PaymentHubRequest}
 */
export const transformDataToPaymentHubFormat = (
  identifiers,
  grant,
  payment
) => ({
  sourceSystem: grant.sourceSystem,
  ledger: grant.ledger,
  deliveryBody: grant.deliveryBody,
  invoiceNumber: updateQuarter(grant.invoiceNumber, grant?.payments, payment),
  frn: identifiers.frn,
  sbi: identifiers.sbi,
  fesCode: grant.fesCode,
  marketingYear: grant.marketingYear || new Date().getFullYear(),
  paymentRequestNumber: grant.paymentRequestNumber,
  agreementNumber: asNumbersOnly(grant.agreementNumber),
  contractNumber: identifiers.claimId,
  currency: payment.currency || 'GBP',
  dueDate: formatPaymentDate(payment.dueDate),
  remittanceDescription: grant.remittanceDescription,
  invoiceLines: buildInvoiceLines(grant, payment),
  correlationId: payment.correlationId,

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
  value: valueFormatter.format(
    -Math.abs(
      payment.invoiceLines.reduce(
        (acc, line) => acc + Number(line.amountPence),
        0
      )
    ) / 100
  ),
  ...(grant.totalAmountPence != null && {
    annualValue: valueFormatter.format(Number(grant.totalAmountPence) / 100)
  }),

  // Transform the data based on the scheme using the appropriate transformer
  ...(transformers[grant.sourceSystem]
    ? transformers[grant.sourceSystem](grant, payment)
    : {})
})

/** @import { schema, Grant, Payment } from '#~/api/common/models/grant_payments.js' */
/** @import { PaymentHubRequest } from '#~/common/types/payment-hub.d.js' */
