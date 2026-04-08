import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const fetchAllGrantPayments = async (page) => {
  let query = GrantPaymentsModel.find({}).sort({ createdAt: -1 })
  if (page) {
    const limit = 10
    const skip = (page - 1) * limit
    query = query.skip(skip).limit(limit)
  }
  return query.lean()
}
