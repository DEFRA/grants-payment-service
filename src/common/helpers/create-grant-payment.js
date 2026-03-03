import GrantPaymentsModel from '#~/api/common/grant_payments.js'

export const createGrantPayment = async (payload) => {
  return GrantPaymentsModel.create(payload)
}
