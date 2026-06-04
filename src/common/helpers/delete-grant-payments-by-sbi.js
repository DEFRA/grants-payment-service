import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const deleteGrantPaymentsBySbi = async (sbi, fundCode) => {
  const match = fundCode
    ? { sbi, 'grants.payments.invoiceLines.fundCode': fundCode }
    : { sbi }
  const result = await GrantPaymentsModel.deleteMany(match)
  return { deletedCount: result.deletedCount }
}
