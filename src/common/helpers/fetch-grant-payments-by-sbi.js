import GrantPaymentsModel from '#~/api/common/grant_payments.js'

export const fetchGrantPaymentsBySbi = async (sbi) => {
  return GrantPaymentsModel.find({ sbi }).lean()
}
