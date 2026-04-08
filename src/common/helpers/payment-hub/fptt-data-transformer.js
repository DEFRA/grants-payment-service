import { formatPaymentDate } from '#~/common/helpers/format-payment-date.js'
import { getActionCodeByName } from '#~/common/helpers/config-mapper/index.js'

const DEBT_TYPE_MAX_LENGTH = 3
const MONTHS_PER_YEAR = 12
const QUARTER_MONTHS = 3
const QUARTERS_PER_YEAR = 4

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

const REMITTANCE_DESCRIPTION_MAX_LENGTH = 60

const validateRemittanceDescription = (remittanceDescription) => {
  if (remittanceDescription.length > REMITTANCE_DESCRIPTION_MAX_LENGTH) {
    throw new Error(
      `value of ${remittanceDescription} must be no more than ${REMITTANCE_DESCRIPTION_MAX_LENGTH} characters`
    )
  }
  return remittanceDescription
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

/**
 * Calculates the quarter suffix for an invoice number based on the first payment due date and the current payment due date
 * @param {string} invoiceNumber
 * @param {string} firstPaymentDueDate
 * @param {string} thisPaymentDueDate
 * @returns string
 */
const updateQuarter = (
  invoiceNumber,
  firstPaymentDueDate,
  thisPaymentDueDate
) => {
  const invoiceWithoutQuarter = invoiceNumber.replace(/Q[1-4X]$/i, '')

  const firstDate = new Date(firstPaymentDueDate || thisPaymentDueDate)
  const thisDate = new Date(thisPaymentDueDate)

  if (Number.isNaN(firstDate.valueOf()) || Number.isNaN(thisDate.valueOf())) {
    throw new TypeError('Invalid payment due date')
  }

  const monthsSinceFirstPayment =
    (thisDate.getUTCFullYear() - firstDate.getUTCFullYear()) * MONTHS_PER_YEAR +
    (thisDate.getUTCMonth() - firstDate.getUTCMonth())

  if (monthsSinceFirstPayment < 0) {
    throw new Error('thisPaymentDueDate cannot be before firstPaymentDueDate')
  }

  const quarterOffset = Math.floor(monthsSinceFirstPayment / QUARTER_MONTHS)
  const quarter =
    (((quarterOffset % QUARTERS_PER_YEAR) + QUARTERS_PER_YEAR) %
      QUARTERS_PER_YEAR) +
    1

  return `${invoiceWithoutQuarter}Q${quarter}`
}

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
  ledger: grant.ledger,
  deliveryBody: grant.deliveryBody,
  invoiceNumber: updateQuarter(
    grant.invoiceNumber,
    grant?.payments?.[0]?.dueDate,
    payment.dueDate
  ),
  frn: identifiers.frn,
  sbi: identifiers.sbi,
  fesCode: grant.fesCode,
  marketingYear: grant.marketingYear || new Date().getFullYear(),
  paymentRequestNumber: grant.paymentRequestNumber,
  agreementNumber: asNumbersOnly(grant.agreementNumber),
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
  })
})

/** @import { schema, Grant, Payment } from '#~/api/common/models/grant_payments.js' */
/** @import { PaymentHubRequest } from '#~/common/types/payment-hub.d.js' */
