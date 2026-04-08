import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const fetchGrantPaymentsByDate = async (date, status, page) => {
  const match = {
    'grants.payments.dueDate': date
  }
  const filters = [{ $eq: ['$$p.dueDate', date] }]

  if (status) {
    match['grants.payments.status'] = status
    filters.push({ $eq: ['$$p.status', status] })
  }

  const pipeline = [{ $match: match }, { $sort: { createdAt: -1 } }]

  if (page) {
    const limit = 10
    const skip = (page - 1) * limit
    pipeline.push({ $skip: skip }, { $limit: limit })
  }

  pipeline.push({
    $project: {
      sbi: 1,
      frn: 1,
      claimId: 1,
      grants: {
        $map: {
          input: '$grants',
          as: 'g',
          in: {
            $mergeObjects: [
              '$$g',
              {
                payments: {
                  $filter: {
                    input: '$$g.payments',
                    as: 'p',
                    cond: { $and: filters }
                  }
                }
              }
            ]
          }
        }
      }
    }
  })

  return GrantPaymentsModel.aggregate(pipeline)
}
