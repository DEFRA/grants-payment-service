export const transformWmpPayment = (grant, _payment) => ({
  invoiceNumber: grant.invoiceNumber.replace(/Q[1-4X]$/i, '')
})
