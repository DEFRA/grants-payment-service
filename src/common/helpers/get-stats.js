import GrantPayments from '#~/api/common/models/grant_payments.js'

export const getStats = async () => {
  const accounts = await GrantPayments.countDocuments()

  const grantStats = await GrantPayments.aggregate([
    { $unwind: '$grants' },
    { $group: { _id: null, count: { $sum: 1 } } }
  ])

  const grants = grantStats.length > 0 ? grantStats[0].count : 0

  const paymentStats = await GrantPayments.aggregate([
    { $unwind: '$grants' },
    { $unwind: '$grants.payments' },
    { $group: { _id: '$grants.payments.status', count: { $sum: 1 } } }
  ])

  let totalPayments = 0
  const statusCounts = {
    pending: 0,
    submitted: 0,
    cancelled: 0,
    locked: 0,
    failed: 0
  }

  paymentStats.forEach((stat) => {
    statusCounts[stat._id] = stat.count
    totalPayments += stat.count
  })

  return {
    accounts,
    grants,
    payments: {
      total: totalPayments,
      ...statusCounts
    }
  }
}
