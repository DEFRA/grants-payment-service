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
    const grantPayment = await cancelGrantPayments(sbi, frn)

    if (grantPayment.length) {
      logger.info(
        { messageId, sbi },
        `Successfully cancelled grant payment entry ${JSON.stringify(grantPayment)}`
      )
    } else {
      logger.warn(
        `No grant payment entry found to cancel for sbi ${sbi} and frn ${frn}`
      )
    }
  } catch (err) {
    logger.error(err, grafanaLogMessages.error.cancelPayment)
  }
}
