export const transformWmpPayment = (grant, _payment) => ({
  dueDate: '',
  invoiceNumber: grant.invoiceNumber.replace(/Q[1-4X]$/i, '')
})
