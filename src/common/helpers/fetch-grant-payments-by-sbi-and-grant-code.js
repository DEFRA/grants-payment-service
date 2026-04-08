import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const fetchGrantPaymentsBySbiAndGrantCode = async (
  sbi,
  grantCode,
  page
) => {
  let query = GrantPaymentsModel.find({
    sbi,
    'grants.fundCode': grantCode
  }).sort({ createdAt: -1 })

  if (page) {
    const limit = 10
    const skip = (page - 1) * limit
    query = query.skip(skip).limit(limit)
  }

  return query.lean()
}
