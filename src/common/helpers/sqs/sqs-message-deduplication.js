import ProcessedSqsMessagesModel from '#~/api/common/models/processed_sqs_messages.js'

const mongoDuplicateKeyErrorCode = 11000

/**
 * Run an SQS handler once per (queueTag, messageId) when transport deduplication is enabled.
 *
 * Completion records are removed automatically by a MongoDB TTL index on
 * {@link PROCESSED_SQS_MESSAGE_TTL_SECONDS} (SQS max message retention of
 * {@link AWS_SQS_MAX_MESSAGE_RETENTION_SECONDS} plus
 * {@link PROCESSED_SQS_MESSAGE_TTL_BUFFER_SECONDS}).
 *
 * @param {{
 *   enabled: boolean,
 *   queueTag: string,
 *   messageId: string,
 *   messageBody: string,
 *   logger: import('pino').Logger,
 *   run: () => Promise<void>
 * }} options
 */
export async function runWithSqsMessageDeduplication({
  enabled,
  queueTag,
  messageId,
  messageBody,
  logger,
  run
}) {
  if (!enabled || messageId === 'unknown-message-id') {
    await run()
    return
  }

  const alreadyProcessed = await ProcessedSqsMessagesModel.exists({
    queueTag,
    messageId
  })

  if (alreadyProcessed) {
    logger.info(
      `Skipping already processed SQS message "${queueTag}" (${messageId}): ${JSON.stringify(messageBody, null, 2)}`
    )
    return
  }

  await run()

  try {
    await ProcessedSqsMessagesModel.create({ queueTag, messageId })
  } catch (error) {
    const isDuplicateKeyError =
      error?.name === 'MongoServerError' &&
      error?.code === mongoDuplicateKeyErrorCode

    if (isDuplicateKeyError) {
      logger.info(
        { queueTag, messageId },
        'SQS message was processed concurrently; duplicate completion record'
      )
      return
    }

    throw error
  }
}
