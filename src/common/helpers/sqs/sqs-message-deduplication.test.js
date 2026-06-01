import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('#~/api/common/models/processed_sqs_messages.js', () => ({
  default: {
    exists: vi.fn(),
    create: vi.fn()
  }
}))

import ProcessedSqsMessagesModel from '#~/api/common/models/processed_sqs_messages.js'
import { PROCESSED_SQS_MESSAGE_TTL_SECONDS } from './processed-sqs-message-retention.js'
import { runWithSqsMessageDeduplication } from './sqs-message-deduplication.js'

describe('processed-sqs-message-retention', () => {
  it('uses AWS SQS maximum message retention (14 days) plus a one-hour buffer', () => {
    expect(PROCESSED_SQS_MESSAGE_TTL_SECONDS).toBe(1_209_600 + 3_600)
  })
})

describe('runWithSqsMessageDeduplication', () => {
  const logger = {
    info: vi.fn()
  }

  const baseOptions = {
    enabled: true,
    queueTag: 'create-payment',
    messageId: 'sqs-msg-1',
    logger,
    run: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ProcessedSqsMessagesModel.exists.mockResolvedValue(null)
    ProcessedSqsMessagesModel.create.mockResolvedValue({})
    baseOptions.run.mockResolvedValue(undefined)
  })

  it('runs handler without Mongo lookups when deduplication is disabled', async () => {
    await runWithSqsMessageDeduplication({
      ...baseOptions,
      enabled: false
    })

    expect(baseOptions.run).toHaveBeenCalledOnce()
    expect(ProcessedSqsMessagesModel.exists).not.toHaveBeenCalled()
    expect(ProcessedSqsMessagesModel.create).not.toHaveBeenCalled()
  })

  it('runs handler without Mongo lookups when message id is unknown', async () => {
    await runWithSqsMessageDeduplication({
      ...baseOptions,
      messageId: 'unknown-message-id'
    })

    expect(baseOptions.run).toHaveBeenCalledOnce()
    expect(ProcessedSqsMessagesModel.exists).not.toHaveBeenCalled()
    expect(ProcessedSqsMessagesModel.create).not.toHaveBeenCalled()
  })

  it('skips handler when message was already processed', async () => {
    ProcessedSqsMessagesModel.exists.mockResolvedValue({ _id: 'existing' })

    await runWithSqsMessageDeduplication(baseOptions)

    expect(baseOptions.run).not.toHaveBeenCalled()
    expect(ProcessedSqsMessagesModel.create).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      { queueTag: 'create-payment', messageId: 'sqs-msg-1' },
      'Skipping already processed SQS message'
    )
  })

  it('runs handler and records completion when message is new', async () => {
    await runWithSqsMessageDeduplication(baseOptions)

    expect(ProcessedSqsMessagesModel.exists).toHaveBeenCalledWith({
      queueTag: 'create-payment',
      messageId: 'sqs-msg-1'
    })
    expect(baseOptions.run).toHaveBeenCalledOnce()
    expect(ProcessedSqsMessagesModel.create).toHaveBeenCalledWith({
      queueTag: 'create-payment',
      messageId: 'sqs-msg-1'
    })
  })

  it('does not record completion when handler fails', async () => {
    const error = new Error('handler failed')
    baseOptions.run.mockRejectedValue(error)

    await expect(runWithSqsMessageDeduplication(baseOptions)).rejects.toThrow(
      'handler failed'
    )

    expect(ProcessedSqsMessagesModel.create).not.toHaveBeenCalled()
  })

  it('treats duplicate completion insert as success', async () => {
    const duplicateError = new Error('duplicate')
    duplicateError.name = 'MongoServerError'
    duplicateError.code = 11000
    ProcessedSqsMessagesModel.create.mockRejectedValue(duplicateError)

    await runWithSqsMessageDeduplication(baseOptions)

    expect(logger.info).toHaveBeenCalledWith(
      { queueTag: 'create-payment', messageId: 'sqs-msg-1' },
      'SQS message was processed concurrently; duplicate completion record'
    )
  })

  it('rethrows non-duplicate errors from completion insert', async () => {
    const error = new Error('database unavailable')
    ProcessedSqsMessagesModel.create.mockRejectedValue(error)

    await expect(runWithSqsMessageDeduplication(baseOptions)).rejects.toThrow(
      'database unavailable'
    )
  })
})
