import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const fetchGrantPaymentsBySbi = async (sbi) => {
  return GrantPaymentsModel.find({ sbi }).lean()
}
