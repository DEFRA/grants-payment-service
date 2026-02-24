/**
 * Minimal handler for SFIR-1023 to prove we can consume the inbound create_payment event.
 *
 * @param {string} messageId
 * @param {any} payload
 * @param {import('pino').Logger} logger
 */
export async function handleCreatePaymentEvent(messageId, payload, logger) {
  // Minimal behaviour: log receipt. Business logic comes in later tickets.
  logger.info(
    { messageId, eventType: payload?.type, agreementId: payload?.agreementId },
    'Received create_payment message'
  )
}
