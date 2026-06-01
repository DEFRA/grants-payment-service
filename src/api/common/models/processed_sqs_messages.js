import mongoose from 'mongoose'

import { PROCESSED_SQS_MESSAGE_TTL_SECONDS } from '#~/common/helpers/sqs/processed-sqs-message-retention.js'

const collection = 'processed_sqs_messages'

const schema = new mongoose.Schema(
  {
    queueTag: { type: String, required: true },
    messageId: { type: String, required: true },
    processedAt: { type: Date, required: true, default: Date.now }
  },
  { collection }
)

schema.index({ queueTag: 1, messageId: 1 }, { unique: true })
schema.index(
  { processedAt: 1 },
  { expireAfterSeconds: PROCESSED_SQS_MESSAGE_TTL_SECONDS }
)

export default mongoose.model(collection, schema)
