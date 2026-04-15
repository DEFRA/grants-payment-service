import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'
import { getTodaysDate } from '#~/common/helpers/date.js'

/**
 * Controller to post trigger payment processing for a specific date, or the current date if no date is provided.
 * @satisfies {Partial<ServerRoute>}
 */
const postTestProcessPaymentsController = {
  handler: async (request, h) => {
    try {
      const { date } = request.params

      const first10Payments = await processDailyPayments(
        request.server,
        10,
        date
      )

      processDailyPayments(request.server, undefined, date)

      return h
        .response({
          message: `Triggered daily payment processing for ${date || getTodaysDate()}, showing first 10 payments, check logs for more details`,
          result: first10Payments
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

export { postTestProcessPaymentsController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
