import { statusCodes } from '#~/common/constants/status-codes.js'
import { getTodaysDate } from '#~/common/helpers/date.js'
import { fetchGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'

/**
 * Controller to get test daily payments for a specific date, or the current date if no date is provided.
 * @satisfies {Partial<ServerRoute>}
 */
const getTestDailyPaymentsController = {
  handler: async (request, h) => {
    try {
      const { date = getTodaysDate() } = request.query
      const docs = await fetchGrantPaymentsByDate(date)

      return h.response({ date, docs }).code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(error, `Error getting test daily payments`)
      return h
        .response({
          message: 'Failed to get test daily payments',
          error
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { getTestDailyPaymentsController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
