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
    { messageId, eventType: 'create_payment', sbi: payload?.sbi },
    'Received create_payment message'
  )

  const grantPayment = await createGrantPayment(payload)

  logger.info(
    `Managed to successfully create grantPayment entry ${JSON.stringify(grantPayment)}`
  )
}
