import { statusCodes } from '#~/common/constants/status-codes.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'

/**
 * Controller to post trigger payment processing for a specific date, or the current date if no date is provided.
 * @satisfies {Partial<ServerRoute>}
 */
const postTestProcessPaymentsController = {
  handler: async (request, h) => {
    try {
      const { date } = request.params

      const result = await processDailyPayments(request.server, date)

      return h.response({ result }).code(statusCodes.ok)
    } catch (error) {
      if (error.isBoom) {
        return error
      }

      request.logger.error(error, `Error triggering test process payments`)
      return h
        .response({
          message: 'Failed to trigger test process payments',
          error
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { postTestProcessPaymentsController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
