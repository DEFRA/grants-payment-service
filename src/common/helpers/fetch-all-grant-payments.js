import GrantPaymentsModel from '#~/api/common/grant_payments.js'

export const fetchAllGrantPayments = async () => {
  return GrantPaymentsModel.find({}).lean()
}
