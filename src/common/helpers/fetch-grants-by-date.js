import GrantPaymentsModel from '#~/api/common/grant_payments.js'

export const fetchGrantPaymentsByDate = async (date) => {
  return GrantPaymentsModel.find({ 'grants.dueDate': date }).lean()
}
