/** AWS SQS maximum message retention period (14 days). */
const AWS_SQS_MAX_MESSAGE_RETENTION_SECONDS = 1_209_600

/** Buffer after max retention before dedup records may be removed. */
const PROCESSED_SQS_MESSAGE_TTL_BUFFER_SECONDS = 3_600

/**
 * TTL for processed SQS message dedup records.
 * Matches max time the same message can remain on a queue, plus one hour.
 */
export const PROCESSED_SQS_MESSAGE_TTL_SECONDS =
  AWS_SQS_MAX_MESSAGE_RETENTION_SECONDS +
  PROCESSED_SQS_MESSAGE_TTL_BUFFER_SECONDS
