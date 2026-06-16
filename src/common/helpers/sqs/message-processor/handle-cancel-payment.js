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
  logger.info(
    { messageId, eventType: payload.type, sbi: payload?.data?.sbi },
    `Received cancel_payment event with payload ${JSON.stringify(payload, null, 2)}`
  )

  const { sbi, frn } = payload.data

  try {
    const { updatedPayments, foundGrantPayments } = await cancelGrantPayments(
      sbi,
      frn
    )

    if (updatedPayments.length) {
      logger.info(
        { messageId, sbi },
        `Successfully cancelled grant payment entry ${JSON.stringify(updatedPayments)}`
      )
    } else if (foundGrantPayments.length) {
      logger.warn(
        { messageId, sbi },
        `Found grant payment entries for sbi ${sbi} and frn ${frn}, but none were in a pending state to be cancelled`
      )
    } else {
      logger.warn(
        `${grafanaLogMessages.warning.noGrantPaymentEntryFound} to cancel for sbi ${sbi} and frn ${frn}`
      )
    }
  } catch (err) {
    logger.error(err, grafanaLogMessages.error.cancelPayment)
  }
}
