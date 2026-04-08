import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const fetchGrantPaymentsBySbi = async (sbi, page) => {
  let query = GrantPaymentsModel.find({ sbi }).sort({ createdAt: -1 })
  if (page) {
    const limit = 10
    const skip = (page - 1) * limit
    query = query.skip(skip).limit(limit)
  }
  return query.lean()
}
