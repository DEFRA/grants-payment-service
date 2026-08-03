import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { config } from '#~/config/index.js'
import { getNextDay } from './date.js'
import { wrapWithPagination } from './pagination.js'
import { getActionCodeByName } from '#~/common/helpers/config-mapper/index.js'

/**
 * Gets the list of disabled scheme action codes including both names and their corresponding scheme codes.
 * @returns {string[]} Array of disabled scheme action codes (names and numeric codes)
 */
const getDisabledSchemeActionCodes = () => {
  const disabledActionCodes = config.get('disabledActionCodes')
  return [
    ...disabledActionCodes,
    ...disabledActionCodes.map(getActionCodeByName)
  ]
}

/**
 * Builds a MongoDB match filter to exclude payments with disabled action codes in invoice lines.
 * Used in the $match stage of aggregation pipelines.
 * @returns {object} MongoDB match filter expression
 */
const buildInvoiceLinesMatchFilter = () => ({
  invoiceLines: {
    $not: {
      $elemMatch: {
        schemeCode: { $in: getDisabledSchemeActionCodes() }
      }
    }
  }
})

/**
 * Builds a MongoDB project filter to exclude payments with disabled action codes in invoice lines.
 * Used in the $project stage of aggregation pipelines to filter matched payments.
 * @returns {object} MongoDB project filter expression
 */
const buildInvoiceLinesProjectFilter = () => ({
  $not: {
    $anyElementTrue: {
      $map: {
        input: '$$p.invoiceLines',
        as: 'il',
        in: {
          $in: ['$$il.schemeCode', getDisabledSchemeActionCodes()]
        }
      }
    }
  }
})

/**
 * Builds a MongoDB $match stage for filtering grant payments.
 * @param {object} paymentMatch - The payment match criteria
 * @returns {object} MongoDB $match stage
 */
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

/**
 * Builds a MongoDB $project stage to transform grant payment documents.
 * Filters payments and projects only relevant fields.
 * @param {Array} filters - Array of filter conditions for the $filter operation
 * @returns {object} MongoDB $project stage
 */
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

/**
 * Builds a final MongoDB $match stage to exclude documents with no matched payments.
 * @returns {object} MongoDB $match stage
 */
const buildFinalMatchStage = () => ({
  $match: {
    grants: {
      $elemMatch: {
        'matchedPayments.0': { $exists: true }
      }
    }
  }
})

/**
 * Builds a MongoDB aggregation pipeline for fetching grant payments by date.
 * @param {string} date - The date to filter payments by (dueDate <= date + 1 day)
 * @param {string} [status] - Optional payment status to filter by
 * @param {number} [limit] - Optional limit for number of results
 * @param {number} [page] - Optional page number for pagination
 * @returns {object} Object containing the pipeline array and match criteria for counting
 */
const buildGrantPaymentsAggregationPipeline = (date, status, limit, page) => {
  const nextDay = getNextDay(date)
  const paymentMatch = {
    dueDate: { $lte: nextDay },
    ...buildInvoiceLinesMatchFilter()
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

  filters.push(buildInvoiceLinesProjectFilter())
  pipeline.push(buildProjectStage(filters), buildFinalMatchStage())

  return { pipeline, match }
}

/**
 * Fetches grant payments by date with optional status filter and pagination.
 * @param {string} date - The date to filter payments by (dueDate <= date + 1 day)
 * @param {string} [status] - Optional payment status to filter by
 * @param {number} [limit] - Optional limit for number of results
 * @param {number} [page] - Optional page number for pagination
 * @returns {Promise<object>} Paginated result with docs, totalDocs, and pagination metadata
 */
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

/**
 * Creates a cursor stream for fetching grant payments by date.
 * Useful for processing large result sets without loading all data into memory.
 * @param {string} date - The date to filter payments by (dueDate <= date + 1 day)
 * @param {string} [status] - Optional payment status to filter by
 * @param {number} [limit] - Optional limit for number of results
 * @param {number} [page] - Optional page number for pagination
 * @returns {object} MongoDB aggregation cursor
 */
export const streamGrantPaymentsByDate = (date, status, limit, page) => {
  const { pipeline } = buildGrantPaymentsAggregationPipeline(
    date,
    status,
    limit,
    page
  )

  return GrantPaymentsModel.aggregate(pipeline).cursor()
}

/**
 * Builds payment match criteria for filtering by correlation IDs.
 * @param {string[]} correlationIds - Array of correlation IDs to match
 * @param {string} [status] - Optional payment status to filter by
 * @returns {object} Payment match criteria
 */
const buildPaymentMatchCriteria = (correlationIds, status) => {
  const paymentMatch = {
    correlationId: { $in: correlationIds },
    ...buildInvoiceLinesMatchFilter()
  }

  if (status) {
    paymentMatch.status = status
  }

  return paymentMatch
}

/**
 * Builds a project stage with filters for correlation ID queries.
 * @param {string[]} correlationIds - Array of correlation IDs to match
 * @param {string} [status] - Optional payment status to filter by
 * @returns {object} MongoDB $project stage
 */
const buildCorrelationIdsProjectStage = (correlationIds, status) => {
  const filters = [
    { $in: ['$$p.correlationId', correlationIds] },
    status ? { $eq: ['$$p.status', status] } : true,
    buildInvoiceLinesProjectFilter()
  ]
  return buildProjectStage(filters)
}

/**
 * Applies limit and sort stages to an aggregation pipeline.
 * @param {Array} pipeline - The aggregation pipeline to modify
 * @param {number} [limit] - Optional limit for number of results
 */
const applyLimitAndSortToPipeline = (pipeline, limit) => {
  if (limit) {
    pipeline.push({ $limit: limit }, { $sort: { createdAt: -1 } })
  }
}

/**
 * Creates a cursor stream for fetching grant payments by correlation IDs.
 * Useful for processing large result sets without loading all data into memory.
 * @param {string[]} correlationIds - Array of correlation IDs to match
 * @param {string} [status] - Optional payment status to filter by
 * @param {number} [limit] - Optional limit for number of results
 * @returns {object} MongoDB aggregation cursor
 */
export const streamGrantPaymentsByCorrelationIds = (
  correlationIds,
  status,
  limit
) => {
  const paymentMatch = buildPaymentMatchCriteria(correlationIds, status)

  const pipeline = [
    buildMatchStage(paymentMatch),
    buildCorrelationIdsProjectStage(correlationIds, status),
    buildFinalMatchStage()
  ]

  applyLimitAndSortToPipeline(pipeline, limit)

  return GrantPaymentsModel.aggregate(pipeline).cursor()
}
