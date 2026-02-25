import GrantPaymentsModel from '#~/api/common/grant_payments.js'

export const fetchGrantPaymentsBySbiAndGrantCode = async (sbi, grantCode) => {
  return GrantPaymentsModel.find({
    sbi,
    'grants.payments.fundCode': grantCode
  }).lean()
}
