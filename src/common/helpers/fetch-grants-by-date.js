import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { config } from '#~/config/index.js'
import { getNextDay } from './date.js'
import { wrapWithPagination } from './pagination.js'
import { getActionCodeByName } from '#~/common/helpers/config-mapper/index.js'

const getDisabledSchemeCodes = () => {
  const disabledSchemeCodes = config.get('disabledSchemeCodes')
  return [
    ...disabledSchemeCodes,
    ...disabledSchemeCodes.map(getActionCodeByName)
  ]
}

const getDisabledSchemeCodesFilter = () => ({
  invoiceLines: {
    $not: {
      $elemMatch: {
        schemeCode: { $in: getDisabledSchemeCodes() }
      }
    }
  }
})

const getDisabledSchemeCodesProjectFilter = () => ({
  $not: {
    $anyElementTrue: {
      $map: {
        input: '$$p.invoiceLines',
        as: 'il',
        in: {
          $in: ['$$il.schemeCode', getDisabledSchemeCodes()]
        }
      }
    }
  }
})

const buildMatchStage = (paymentMatch) => ({
  $match: {
    grants: {
      $elemMatch: {
        payments: {
          $elemMatch: paymentMatch
        }
      }
    }
  }
})

const buildProjectStage = (filters) => ({
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
              matchedPayments: {
                $filter: {
                  input: '$$g.payments',
                  as: 'p',
                  cond: {
                    $and: filters
                  }
                }
              }
            }
          ]
        }
      }
    }
  }
})

const buildFinalMatchStage = () => ({
  $match: {
    grants: {
      $elemMatch: {
        'matchedPayments.0': { $exists: true }
      }
    }
  }
})

const buildGrantPaymentsAggregationPipeline = (date, status, limit, page) => {
  const nextDay = getNextDay(date)
  const paymentMatch = {
    dueDate: { $lte: nextDay },
    ...getDisabledSchemeCodesFilter()
  }

  const filters = [{ $lte: ['$$p.dueDate', nextDay] }]

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
  const matchStage = buildMatchStage(paymentMatch)
  const pipeline = [matchStage]

  if (limit) {
    if (page) {
      const skip = (page - 1) * limit
      pipeline.push({ $skip: skip })
    }

    pipeline.push({ $limit: limit }, { $sort: { createdAt: -1 } })
  }

  filters.push(getDisabledSchemeCodesProjectFilter())
  pipeline.push(buildProjectStage(filters), buildFinalMatchStage())

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

const buildPaymentMatchForCorrelationIds = (correlationIds, status) => {
  const paymentMatch = {
    correlationId: { $in: correlationIds },
    ...getDisabledSchemeCodesFilter()
  }

  if (status) {
    paymentMatch.status = status
  }

  return paymentMatch
}

const buildProjectStageForCorrelationIds = (correlationIds, status) => {
  const filters = [
    { $in: ['$$p.correlationId', correlationIds] },
    status ? { $eq: ['$$p.status', status] } : true,
    getDisabledSchemeCodesProjectFilter()
  ]
  return buildProjectStage(filters)
}

const addLimitAndSort = (pipeline, limit) => {
  if (limit) {
    pipeline.push({ $limit: limit }, { $sort: { createdAt: -1 } })
  }
}

export const streamGrantPaymentsByCorrelationIds = (
  correlationIds,
  status,
  limit
) => {
  const paymentMatch = buildPaymentMatchForCorrelationIds(
    correlationIds,
    status
  )

  const pipeline = [
    buildMatchStage(paymentMatch),
    buildProjectStageForCorrelationIds(correlationIds, status),
    buildFinalMatchStage()
  ]

  addLimitAndSort(pipeline, limit)

  return GrantPaymentsModel.aggregate(pipeline).cursor()
}
