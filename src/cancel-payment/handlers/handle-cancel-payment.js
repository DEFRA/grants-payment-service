import { cancelGrantPayments } from '#~/common/helpers/cancel-grant-payment.js'

/**
 * Minimal handler for SFIR-1023 to prove we can consume the inbound create_payment event.
 *
 * @param {string} messageId
 * @param {any} payload
 * @param {import('pino').Logger} logger
 */
export async function handleCancelPaymentEvent(messageId, payload, logger) {
  logger.info(
    { messageId, eventType: payload.type, sbi: payload?.data?.sbi },
    `Received cancel_payment event with payload is  ${JSON.stringify(payload, null, 2)}`
  )

  const { sbi, frn } = payload.data

  const grantPayment = await cancelGrantPayments(sbi, frn)

  logger.info(
    `Managed to successfully cancel grantPayment entry ${JSON.stringify(grantPayment)}`
  )
}
