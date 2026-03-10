import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const fetchAllGrantPayments = async () => {
  return GrantPaymentsModel.find({}).lean()
}
