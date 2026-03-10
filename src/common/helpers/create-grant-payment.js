import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const createGrantPayment = async (payload) => {
  return GrantPaymentsModel.create(payload)
}
