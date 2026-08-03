import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const deleteGrantPaymentsBySbi = async (sbi, fundCode) => {
  const match = {
    sbi,
    ...(fundCode ? { 'grants.payments.invoiceLines.fundCode': fundCode } : {})
  }
  const result = await GrantPaymentsModel.deleteMany(match)
  return { deletedCount: result.deletedCount }
}
