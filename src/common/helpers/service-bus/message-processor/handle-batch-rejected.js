/**
 * Inbound BATCH_REJECTED event handler
 * @param {string} messageId
 * @param {{ type?: string, data?: object }} payload
 * @param {import('pino').Logger} logger
 */
export function handleBatchRejectedEvent(messageId, payload, logger) {
  logger.warn(
    {
      messageId,
      eventType: payload?.type ?? 'BATCH_REJECTED',
      sbi: payload?.data?.sbi
    },
    `Received batch rejected event (messageId: ${messageId}): ${JSON.stringify(payload, null, 2)}`
  )
}
