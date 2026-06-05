import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'
import {
  getNextDay,
  getTodaysDate,
  getTomorrowsDate
} from '#~/common/helpers/date.js'
import { config } from '#~/config/index.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

/**
 * Fetches correlation IDs for a given SBI from the database
 * @param {string} sbi - The SBI to fetch payments for
 * @param {object} logger - Logger instance
 * @returns {Promise<string[]>} Array of correlation IDs
 */
const fetchCorrelationIdsBySbi = async (sbi, logger) => {
  const accounts = await GrantPaymentsModel.find({ sbi }).lean()

  logger.info(`Found ${accounts.length} accounts for SBI: ${sbi}`)

  const correlationIds = accounts
    .flatMap((account) =>
      account.grants.flatMap((grant) =>
        grant.payments.map((payment) => payment.correlationId)
      )
    )
    .filter(Boolean)

  logger.info(
    `Extracted ${correlationIds.length} correlation IDs for SBI: ${sbi}`
  )

  return correlationIds
}

/**
 * Processes payments with the given processor options
 * @param {object} request - Hapi request object
 * @param {object} processorOptions - Options to pass to processDailyPayments
 * @returns {Promise<object>} Result with payments and metadata
 */
const processPayments = async (request, processorOptions) => {
  const paginationLimit = config.get('paginationLimit')
  const {
    results: firstXPayments,
    backgroundTasks: firstXBackgroundTasks,
    fetchDuration: fetchDur,
    processDuration: procDur,
    sendDuration: sendDur
  } = await processDailyPayments(
    request.server,
    paginationLimit,
    processorOptions
  )

  // Await background tasks to get full payment hub responses for firstXPayments
  const firstXPaymentResponses = await Promise.all(
    (firstXBackgroundTasks || []).filter(Boolean)
  )

  // Combine each payment with its corresponding response
  const paymentsWithResponses = firstXPayments.map((payment, index) => ({
    ...firstXPaymentResponses[index],
    db: payment
  }))

  // Process remaining payments in background
  processDailyPayments(request.server, undefined, processorOptions).then(
    ({ results, fetchDuration, processDuration, sendDuration }) => {
      const totalFetch = (
        Number.parseFloat(fetchDur) + Number.parseFloat(fetchDuration)
      ).toFixed(2)
      const totalProc = (
        Number.parseFloat(procDur) + Number.parseFloat(processDuration)
      ).toFixed(2)
      const totalSend = (
        Number.parseFloat(sendDur) + Number.parseFloat(sendDuration)
      ).toFixed(2)

      request.logger.info(
        `Processed ${firstXPayments.length + results.length} payment(s) (fetch: ${totalFetch}ms, process: ${totalProc}ms, send: ${totalSend}ms)`
      )
    }
  )

  return { paymentsWithResponses, paginationLimit }
}

/**
 * Controller to post trigger payment processing for a specific date, or the current date if no date is provided.
 * @satisfies {Partial<ServerRoute>}
 */
const postTestProcessPaymentsController = {
  handler: async (request, h) => {
    try {
      const { date } = request.params

      const { paymentsWithResponses, paginationLimit } = await processPayments(
        request,
        { date }
      )

      const dateLog = date
        ? `${date} - ${getNextDay(date)}`
        : `${getTodaysDate()} - ${getTomorrowsDate()}`

      return h
        .response({
          message: `Triggered daily payment processing for ${dateLog}, showing first ${paginationLimit} payments with full details, check logs for more details`,
          result: paymentsWithResponses
        })
        .code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(error, `Error triggering test process payments`)
      return h
        .response({
          message: 'Failed to trigger test process payments',
          error: serializeError(error)
        })
        .code(statusCodes.internalServerError)
    }
  }
}

/**
 * Controller to post trigger payment processing for a specific SBI.
 * Fetches all payment IDs for the given SBI and processes them.
 * @satisfies {Partial<ServerRoute>}
 */
const postTestProcessPaymentsBySbiController = {
  handler: async (request, h) => {
    try {
      const { sbi } = request.params

      const correlationIds = await fetchCorrelationIdsBySbi(sbi, request.logger)

      if (correlationIds.length === 0) {
        return h
          .response({
            message: `No payments found for SBI: ${sbi}`,
            result: []
          })
          .code(statusCodes.ok)
      }

      const { paymentsWithResponses, paginationLimit } = await processPayments(
        request,
        { correlationIds }
      )

      return h
        .response({
          message: `Triggered payment processing for SBI: ${sbi}, showing first ${paginationLimit} grants with full details, check logs for more details`,
          result: paymentsWithResponses
        })
        .code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(
        error,
        `Error triggering test process payments by SBI`
      )
      return h
        .response({
          message: 'Failed to trigger test process payments by SBI',
          error: serializeError(error)
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export {
  postTestProcessPaymentsController,
  postTestProcessPaymentsBySbiController
}

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
