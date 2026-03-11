import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const fetchGrantPaymentsBySbiAndGrantCode = async (sbi, grantCode) => {
  return GrantPaymentsModel.find({
    sbi,
    'grants.fundCode': grantCode
  }).lean()
}
