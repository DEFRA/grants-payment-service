export const transformWmpPayment = (grant, _payment) => ({
  dueDate: undefined,
  invoiceNumber: grant.invoiceNumber.replace(/Q[1-4X]$/i, '')
})
