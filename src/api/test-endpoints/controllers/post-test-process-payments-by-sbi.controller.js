import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'
import { config } from '#~/config/index.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

/**
 * Controller to post trigger payment processing for a specific SBI.
 * Fetches all payment IDs for the given SBI and processes them.
 * @satisfies {Partial<ServerRoute>}
 */
const postTestProcessPaymentsBySbiController = {
  handler: async (request, h) => {
    try {
      const { sbi } = request.params

      // Fetch all grant payments for the given SBI
      const accounts = await GrantPaymentsModel.find({ sbi }).lean()

      // Extract all payment IDs from the accounts
      const paymentIds = accounts.flatMap((account) =>
        account.grants.flatMap((grant) =>
          grant.payments.map((payment) => payment._id.toString())
        )
      )

      if (paymentIds.length === 0) {
        return h
          .response({
            message: `No payments found for SBI: ${sbi}`,
            result: []
          })
          .code(statusCodes.ok)
      }

      const paginationLimit = config.get('paginationLimit')
      const {
        results: firstXPayments,
        backgroundTasks: firstXBackgroundTasks,
        fetchDuration: fetchDur,
        processDuration: procDur,
        sendDuration: sendDur
      } = await processDailyPayments(request.server, paginationLimit, {
        paymentIds
      })

      // Await background tasks to get full payment hub responses for firstXPayments
      const firstXPaymentResponses = await Promise.all(
        (firstXBackgroundTasks || []).filter(Boolean)
      )

      // Combine each payment with its corresponding response
      const paymentsWithResponses = firstXPayments.map((payment, index) => ({
        ...firstXPaymentResponses[index],
        db: payment
      }))

      processDailyPayments(request.server, undefined, { paymentIds }).then(
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
            `Processed ${firstXPayments.length + results.length} payment(s) for SBI ${sbi} (fetch: ${totalFetch}ms, process: ${totalProc}ms, send: ${totalSend}ms)`
          )
        }
      )

      return h
        .response({
          message: `Triggered payment processing for SBI: ${sbi}, showing first ${paginationLimit} payments with full details, check logs for more details`,
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

export { postTestProcessPaymentsBySbiController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
