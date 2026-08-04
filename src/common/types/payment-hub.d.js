/**
 * @typedef {object} PaymentHubRequest
 * @property {string} sourceSystem - The source system identifier.
 * @property {string} sbi - The single business identifier.
 * @property {string} frn - The firm reference number.
 * @property {string | number} marketingYear - The marketing year.
 * @property {number} paymentRequestNumber - The payment request number.
 * @property {string} correlationId - The unique correlation ID.
 * @property {string} invoiceNumber - The invoice number.
 * @property {string} agreementNumber - The agreement number.
 * @property {string} contractNumber - The contract number.
 * @property {string} currency - The currency code (e.g., GBP).
 * @property {string} [dueDate] - The due date in DD/MM/YYYY format.
 * @property {string} value - The payment value.
 * @property {string} [debtType] - The type of debt (e.g., 'irr').
 * @property {string} [recoveryDate] - The recovery date in DD/MM/YYYY format.
 * @property {string} [annualValue] - The annual value.
 * @property {string} [originalInvoiceNumber] - The original invoice number.
 * @property {string} [originalSettlementDate] - The original settlement date in DD/MM/YYYY format.
 * @property {string | null} [remittanceDescription] - The remittance description.
 * @property {string} [fesCode] - The FES code.
 * @property {string} [ledger] - The ledger.
 * @property {string} [deliveryBody] - The delivery body identifier.
 * @property {Array<PaymentHubInvoiceLine>} [invoiceLines] - The list of invoice lines.
 */

/**
 * @typedef {object} PaymentHubInvoiceLine
 * @property {string} [schemeCode] - The scheme code.
 * @property {string} accountCode - The account code.
 * @property {string} fundCode - The fund code.
 * @property {string} agreementNumber - The agreement number.
 * @property {string} description - The description of the invoice line.
 * @property {string} value - The value of the invoice line.
 * @property {string} deliveryBody - The delivery body identifier.
 * @property {string | number} marketingYear - The marketing year.
 */

/**
 * @typedef {object} InvoiceLine
 * @property {number} value - The value of the invoice line.
 * @property {string} agreementNumber - The agreement number.
 * @property {string} deliveryBody - The delivery body identifier.
 * @property {string} description - The description of the invoice line.
 * @property {string} schemeCode - The scheme code.
 * @property {string} standardCode - The standard code.
 * @property {string} accountCode - The account code.
 * @property {string} fundCode - The fund code.
 * @property {number} marketingYear - The marketing year.
 * @property {boolean} convergence - Indicates if convergence applies.
 * @property {boolean} stateAid - Indicates if state aid applies.
 */
