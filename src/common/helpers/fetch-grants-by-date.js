import GrantPaymentsModel from '#~/api/common/grant_payments.js'

export const fetchGrantPaymentsByDate = async (date, status) => {
  const match = {
    'grants.payments.dueDate': date
  }
  const filters = [{ $eq: ['$$p.dueDate', date] }]

  if (status) {
    match['grants.payments.status'] = status
    filters.push({ $eq: ['$$p.status', status] })
  }

  const pipeline = [
    { $match: match },
    {
      $project: {
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
    }
  ]

  return GrantPaymentsModel.aggregate(pipeline)
}
