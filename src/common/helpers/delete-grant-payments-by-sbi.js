import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const deleteGrantPaymentsBySbi = async (sbi) => {
  const match = { sbi }
  const result = await GrantPaymentsModel.deleteMany(match)
  return { deletedCount: result.deletedCount }
}
