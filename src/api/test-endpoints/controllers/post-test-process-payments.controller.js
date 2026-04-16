import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'
import { getTodaysDate } from '#~/common/helpers/date.js'
import { config } from '#~/config/index.js'

/**
 * Controller to post trigger payment processing for a specific date, or the current date if no date is provided.
 * @satisfies {Partial<ServerRoute>}
 */
const postTestProcessPaymentsController = {
  handler: async (request, h) => {
    try {
      const { date } = request.params

      const paginationLimit = config.get('paginationLimit')
      const {
        results: firstXPayments,
        fetchDuration: fetchDur,
        processDuration: procDur
      } = await processDailyPayments(request.server, paginationLimit, date)

      processDailyPayments(request.server, undefined, date).then(
        ({ results, fetchDuration, processDuration }) => {
          const totalFetch = (
            Number.parseFloat(fetchDur) + Number.parseFloat(fetchDuration)
          ).toFixed(2)
          const totalProc = (
            Number.parseFloat(procDur) + Number.parseFloat(processDuration)
          ).toFixed(2)

          request.logger.info(
            `Processed ${firstXPayments.length + results.length} daily payment(s) (fetch: ${totalFetch}ms, process: ${totalProc}ms)`
          )
        }
      )

      return h
        .response({
          message: `Triggered daily payment processing for ${date || getTodaysDate()}, showing first ${paginationLimit} payments, check logs for more details`,
          result: firstXPayments
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
