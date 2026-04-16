import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { wrapWithPagination } from './pagination.js'

export const fetchGrantPaymentsByDate = async (date, status, limit, page) => {
  const match = {
    'grants.payments.dueDate': date
  }
  const filters = [{ $eq: ['$$p.dueDate', date] }]

  if (status) {
    match['grants.payments.status'] = status
    filters.push({ $eq: ['$$p.status', status] })
  }

  const pipeline = [{ $match: match }, { $sort: { createdAt: -1 } }]

  if (limit) {
    if (page) {
      const skip = (page - 1) * limit
      pipeline.push({ $skip: skip })
    }

    pipeline.push({ $limit: limit })
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

  const [docs, totalDocs] = await Promise.all([
    GrantPaymentsModel.aggregate(pipeline),
    GrantPaymentsModel.countDocuments(match)
  ])

  return wrapWithPagination(docs, totalDocs, page, limit)
}
