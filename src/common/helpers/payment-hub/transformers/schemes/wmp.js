export const transformWmpPayment = (grant, _payment) => ({
  dueDate: undefined, // NOSONAR undefined is required for JSON.stringify to remove the dueDate field when POSTing WMP payments
  annualValue: undefined, // NOSONAR undefined is required for JSON.stringify to remove the annualValue field when POSTing WMP payments
  invoiceNumber: grant.invoiceNumber.replace(/Q[1-4X]$/i, '')
})
