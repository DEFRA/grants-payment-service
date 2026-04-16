import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { wrapWithPagination } from './pagination.js'

const buildGrantPaymentsAggregationPipeline = (date, status, limit, page) => {
  const paymentMatch = { dueDate: date }
  const filters = [{ $eq: ['$$p.dueDate', date] }]

  if (status) {
    paymentMatch.status = status
    filters.push({ $eq: ['$$p.status', status] })
  }

  const match = {
    grants: {
      $elemMatch: {
        payments: {
          $elemMatch: paymentMatch
        }
      }
    }
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

  // Final stage: exclude any records where no grants ended up with any payments
  pipeline.push({
    $match: {
      grants: {
        $elemMatch: {
          'payments.0': { $exists: true }
        }
      }
    }
  })

  return { pipeline, match }
}

export const fetchGrantPaymentsByDate = async (date, status, limit, page) => {
  const { pipeline, match } = buildGrantPaymentsAggregationPipeline(
    date,
    status,
    limit,
    page
  )

  const [docs, totalDocs] = await Promise.all([
    GrantPaymentsModel.aggregate(pipeline),
    GrantPaymentsModel.countDocuments(match)
  ])

  return wrapWithPagination(docs, totalDocs, page, limit)
}

export const streamGrantPaymentsByDate = (date, status, limit, page) => {
  const { pipeline } = buildGrantPaymentsAggregationPipeline(
    date,
    status,
    limit,
    page
  )

  return GrantPaymentsModel.aggregate(pipeline).cursor()
}
