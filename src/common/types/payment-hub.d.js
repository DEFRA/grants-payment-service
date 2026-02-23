/**
 * @typedef {object} PaymentHubRequest
 * @property {string} sourceSystem - The source system identifier.
 * @property {number} sbi - The single business identifier.
 * @property {number} frn - The firm reference number.
 * @property {number} marketingYear - The marketing year.
 * @property {number} paymentRequestNumber - The payment request number.
 * @property {number} paymentType - The payment type.
 * @property {string} correlationId - The unique correlation ID.
 * @property {string} invoiceNumber - The invoice number.
 * @property {string} agreementNumber - The agreement number.
 * @property {string} contractNumber - The contract number.
 * @property {string} currency - The currency code (e.g., GBP).
 * @property {string} schedule - The payment schedule (e.g., Q4).
 * @property {string} dueDate - The due date in DD/MM/YYYY format.
 * @property {number} value - The payment value.
 * @property {string} debtType - The type of debt (e.g., 'irr').
 * @property {string} recoveryDate - The recovery date in DD/MM/YYYY format.
 * @property {string} pillar - The pillar type (e.g., 'DA').
 * @property {string} originalInvoiceNumber - The original invoice number.
 * @property {string} originalSettlementDate - The original settlement date in DD/MM/YYYY format.
 * @property {string} invoiceCorrectionReference - The invoice correction reference.
 * @property {string} trader - The trader identifier.
 * @property {string} vendor - The vendor identifier.
 * @property {Array<InvoiceLine>} invoiceLines - The list of invoice lines.
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
