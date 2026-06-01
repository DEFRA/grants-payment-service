import { afterAll, describe, test, expect } from 'vitest'
import mongoose from 'mongoose'

import { PROCESSED_SQS_MESSAGE_TTL_SECONDS } from '#~/common/helpers/sqs/processed-sqs-message-retention.js'

import ProcessedSqsMessagesModel from './processed_sqs_messages.js'

describe('processed_sqs_messages schema', () => {
  afterAll(() => {
    delete mongoose.connection.models.processed_sqs_messages
  })

  test('should fail validation when required fields are missing', () => {
    const doc = new ProcessedSqsMessagesModel({})
    const err = doc.validateSync()

    expect(err).toBeTruthy()
    expect(err.errors.queueTag).toBeTruthy()
    expect(err.errors.messageId).toBeTruthy()
  })

  test('defines a TTL index on processedAt for dedup record expiry', () => {
    const ttlIndex = ProcessedSqsMessagesModel.schema.indexes().find(
      ([fields, options]) =>
        fields.processedAt === 1 &&
        options.expireAfterSeconds === PROCESSED_SQS_MESSAGE_TTL_SECONDS
    )

    expect(ttlIndex).toBeTruthy()
  })

  test('should pass validation with required fields present', () => {
    const doc = new ProcessedSqsMessagesModel({
      queueTag: 'create-payment',
      messageId: 'abc-123'
    })
    const err = doc.validateSync()

    expect(err).toBeFalsy()
  })
})
