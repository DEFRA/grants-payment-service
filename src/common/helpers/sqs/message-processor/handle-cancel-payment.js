import { cancelGrantPayments } from '#~/common/helpers/cancel-grant-payment.js'
import { grafanaLogMessages } from '#~/common/constants/grafana-log-messages.js'

/**
 * Inbound cancel_payment event handler
 *
 * @param {string} messageId
 * @param {any} payload
 * @param {import('pino').Logger} logger
 */
export async function handleCancelPaymentEvent(messageId, payload, logger) {
  const { sbi, frn } = payload.data

  try {
    const { updatedPayments, foundGrantPayments } = await cancelGrantPayments(
      sbi,
      frn
    )

    if (updatedPayments.length) {
      logger.info(
        { messageId, sbi },
        `Successfully cancelled grant payment entry for message ${messageId}: ${JSON.stringify(updatedPayments)}`
      )
    } else if (foundGrantPayments.length) {
      logger.warn(
        { messageId, sbi },
        `Found grant payment entries for message ${messageId}: sbi ${sbi} and frn ${frn}, but none were in a pending state to be cancelled`
      )
    } else {
      logger.warn(
        `${grafanaLogMessages.warning.noGrantPaymentEntryFound} to cancel for message ${messageId}: sbi ${sbi} and frn ${frn}`
      )
    }
  } catch (err) {
    logger.error(err, grafanaLogMessages.error.cancelPayment)
  }
}
