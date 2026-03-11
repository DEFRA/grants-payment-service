import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'

/**
 * Minimal handler for SFIR-1023 to prove we can consume the inbound create_payment event.
 *
 * @param {string} messageId
 * @param {any} payload
 * @param {import('pino').Logger} logger
 */
export async function handleCreatePaymentEvent(messageId, payload, logger) {
  logger.info(
    { messageId, eventType: payload.type, sbi: payload?.data?.sbi },
    `Received create_payment payload is  ${JSON.stringify(payload, null, 2)}`
  )

  const grantPayment = await createGrantPayment(payload.data)

  logger.info(
    `Managed to successfully create grantPayment entry ${JSON.stringify(grantPayment)}`
  )
}
