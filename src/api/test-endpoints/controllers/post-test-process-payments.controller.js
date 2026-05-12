import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'
import { getTomorrowsDate } from '#~/common/helpers/date.js'
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
        backgroundTasks: firstXBackgroundTasks,
        fetchDuration: fetchDur,
        processDuration: procDur,
        sendDuration: sendDur
      } = await processDailyPayments(request.server, paginationLimit, date)

      // Await background tasks to get full payment hub responses for firstXPayments
      const firstXPaymentResponses = await Promise.all(
        (firstXBackgroundTasks || []).filter(Boolean)
      )

      // Combine each payment with its corresponding response
      const paymentsWithResponses = firstXPayments.map((payment, index) => ({
        ...firstXPaymentResponses[index],
        db: payment
      }))

      processDailyPayments(request.server, undefined, date).then(
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
            `Processed ${firstXPayments.length + results.length} daily payment(s) (fetch: ${totalFetch}ms, process: ${totalProc}ms, send: ${totalSend}ms)`
          )
        }
      )

      return h
        .response({
          message: `Triggered daily payment processing for ${date || getTomorrowsDate()}, showing first ${paginationLimit} payments with full details, check logs for more details`,
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

export { postTestProcessPaymentsController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
