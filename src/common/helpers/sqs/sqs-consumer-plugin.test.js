import { describe, expect, it, vi, beforeEach } from 'vitest'

import { SQSClient } from '@aws-sdk/client-sqs'
import { Consumer } from 'sqs-consumer'

import { createSqsConsumerPlugin } from './sqs-consumer-plugin.js'

vi.mock('@aws-sdk/client-sqs')

vi.mock('sqs-consumer', () => ({
  Consumer: {
    create: vi.fn()
  }
}))

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn((key) => {
      switch (key) {
        case 'aws.region':
          return 'eu-west-2'
        case 'sqs.endpoint':
          return 'http://localhost:4566'
        case 'sqs.maxMessages':
          return 1
        case 'sqs.waitTime':
          return 20
        case 'sqs.visibilityTimeout':
          return 60
        default:
          return undefined
      }
    })
  }
}))

describe('createSqsConsumerPlugin', () => {
  const queueUrl =
    'http://localhost:4566/000000000000/gps__sqs__create_payment.fifo'

  let server
  let mockConsumer
  let mockSqsClient

  beforeEach(() => {
    vi.clearAllMocks()

    server = {
      logger: {
        info: vi.fn(),
        error: vi.fn()
      },
      events: {
        on: vi.fn()
      }
    }

    mockSqsClient = {
      destroy: vi.fn()
    }

    SQSClient.mockImplementation(function () {
      return mockSqsClient
    })

    mockConsumer = {
      on: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }

    Consumer.create.mockReturnValue(mockConsumer)
  })

  it('creates and starts the consumer with config-driven options', async () => {
    const handler = vi.fn()

    const { plugin } = createSqsConsumerPlugin({
      tag: 'create-payment',
      queueUrl,
      handler
    })

    await plugin.register(server)

    expect(SQSClient).toHaveBeenCalledWith({
      region: 'eu-west-2',
      endpoint: 'http://localhost:4566'
    })

    expect(Consumer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        queueUrl,
        sqs: mockSqsClient,
        batchSize: 1,
        waitTimeSeconds: 20,
        visibilityTimeout: 60,
        handleMessage: expect.any(Function)
      })
    )

    expect(mockConsumer.start).toHaveBeenCalled()

    expect(server.events.on).toHaveBeenCalledWith('stop', expect.any(Function))
  })

  it('stops consumer and destroys client on server stop', async () => {
    const handler = vi.fn()

    const { plugin } = createSqsConsumerPlugin({
      tag: 'create-payment',
      queueUrl,
      handler
    })

    await plugin.register(server)

    const stopHandler = server.events.on.mock.calls.find(
      (call) => call[0] === 'stop'
    )[1]

    await stopHandler()

    expect(mockConsumer.stop).toHaveBeenCalled()
    expect(mockSqsClient.destroy).toHaveBeenCalled()
  })

  it('logs errors from consumer', async () => {
    const handler = vi.fn()
    const { plugin } = createSqsConsumerPlugin({
      tag: 'test-tag',
      queueUrl,
      handler
    })
    await plugin.register(server)

    const errorHandler = mockConsumer.on.mock.calls.find(
      (call) => call[0] === 'error'
    )[1]
    const error = new Error('sqs connection failed')
    errorHandler(error)

    expect(server.logger.error).toHaveBeenCalledWith(
      error,
      'SQS consumer (test-tag) error: sqs connection failed'
    )
  })

  it('logs processing errors from consumer', async () => {
    const handler = vi.fn()
    const { plugin } = createSqsConsumerPlugin({
      tag: 'test-tag',
      queueUrl,
      handler
    })
    await plugin.register(server)

    const processingErrorHandler = mockConsumer.on.mock.calls.find(
      (call) => call[0] === 'processing_error'
    )[1]
    const error = new Error('failed to process message')
    processingErrorHandler(error)

    expect(server.logger.error).toHaveBeenCalledWith(
      error,
      'SQS consumer (test-tag) processing error: failed to process message'
    )
  })

  it('uses fallback message id when MessageId is missing', async () => {
    const handler = vi.fn()
    const { plugin } = createSqsConsumerPlugin({
      tag: 'test',
      queueUrl,
      handler
    })
    await plugin.register(server)
    const handleMessage = Consumer.create.mock.calls[0][0].handleMessage

    await handleMessage({ Body: JSON.stringify({ foo: 'bar' }) })

    expect(handler).toHaveBeenCalledWith(
      'unknown-message-id',
      expect.any(Object),
      expect.any(Object)
    )
  })
})

describe('processMessage', () => {
  const queueUrl = 'http://localhost:4566/queue'
  const logger = {
    info: vi.fn(),
    error: vi.fn()
  }

  const baseMessage = {
    MessageId: '123',
    Body: JSON.stringify({ foo: 'bar' })
  }

  let server
  let mockConsumer
  let mockSqsClient

  beforeEach(() => {
    vi.clearAllMocks()

    server = {
      logger,
      events: {
        on: vi.fn()
      }
    }

    mockSqsClient = {
      destroy: vi.fn()
    }

    SQSClient.mockImplementation(function () {
      return mockSqsClient
    })

    mockConsumer = {
      on: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }

    Consumer.create.mockReturnValue(mockConsumer)
  })

  const getHandleMessage = async (handler) => {
    const { plugin } = createSqsConsumerPlugin({
      tag: 'test',
      queueUrl,
      handler
    })
    await plugin.register(server)
    return Consumer.create.mock.calls[0][0].handleMessage
  }

  it('throws badData when message Body is missing', async () => {
    const handleMessage = await getHandleMessage(vi.fn())

    await expect(handleMessage({ MessageId: '1' })).rejects.toMatchObject({
      isBoom: true,
      message: 'SQS message missing Body'
    })
  })

  it('throws badData when message Body is invalid JSON', async () => {
    const handleMessage = await getHandleMessage(vi.fn())
    const message = {
      MessageId: '2',
      Body: '{ not: "json"'
    }

    await expect(handleMessage(message)).rejects.toMatchObject({
      isBoom: true,
      message: `Invalid message format: ${message.Body}`
    })
  })

  it('wraps non-SyntaxError exceptions with Boom', async () => {
    const handlerError = new Error('handler failed')
    const handler = vi.fn().mockRejectedValue(handlerError)
    const handleMessage = await getHandleMessage(handler)

    await expect(handleMessage(baseMessage)).rejects.toMatchObject({
      isBoom: true,
      message: handlerError.message
    })
  })

  it('should process SNS-wrapped messages correctly', async () => {
    const cloudEvent = {
      type: 'cloud.defra.test.fg-gas-backend.agreement.create',
      data: { id: '123', status: 'approved' }
    }

    const snsMessage = {
      Type: 'Notification',
      MessageId: 'sns-message-id',
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
      Message: JSON.stringify(cloudEvent),
      Timestamp: '2023-01-01T00:00:00.000Z',
      SignatureVersion: '1',
      Signature: 'fake-signature',
      SigningCertURL:
        'https://sns.us-east-1.amazonaws.com/SimpleNotificationService.pem',
      UnsubscribeURL: 'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe'
    }

    const sqsMessage = {
      Body: JSON.stringify(snsMessage),
      MessageId: 'sqs-message-id'
    }

    const mockCallback = vi.fn()
    const handleMessage = await getHandleMessage(mockCallback)

    await handleMessage(sqsMessage)

    expect(mockCallback).toHaveBeenCalledWith(
      'sqs-message-id',
      cloudEvent,
      logger
    )
  })

  it('should process raw messages correctly', async () => {
    const cloudEvent = {
      type: 'cloud.defra.test.fg-gas-backend.agreement.create',
      data: { id: '123', status: 'approved' }
    }

    const sqsMessage = {
      Body: JSON.stringify(cloudEvent),
      MessageId: 'sqs-message-id'
    }

    const mockCallback = vi.fn()
    const handleMessage = await getHandleMessage(mockCallback)

    await handleMessage(sqsMessage)

    expect(mockCallback).toHaveBeenCalledWith(
      'sqs-message-id',
      cloudEvent,
      logger
    )
  })

  it('should handle malformed SNS Message field', async () => {
    const snsMessage = {
      Type: 'Notification',
      MessageId: 'sns-message-id',
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
      Message: 'invalid-json',
      Timestamp: '2023-01-01T00:00:00.000Z'
    }

    const sqsMessage = {
      Body: JSON.stringify(snsMessage),
      MessageId: 'sqs-message-id'
    }

    const mockCallback = vi.fn()
    const handleMessage = await getHandleMessage(mockCallback)

    await expect(handleMessage(sqsMessage)).rejects.toMatchObject({
      isBoom: true,
      message: `Invalid message format: ${sqsMessage.Body}`
    })
  })

  it('should handle SNS message without Message field', async () => {
    const snsMessage = {
      Type: 'Notification',
      MessageId: 'sns-message-id',
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
      Timestamp: '2023-01-01T00:00:00.000Z'
    }

    const sqsMessage = {
      Body: JSON.stringify(snsMessage),
      MessageId: 'sqs-message-id'
    }

    const mockCallback = vi.fn()
    const handleMessage = await getHandleMessage(mockCallback)

    await handleMessage(sqsMessage)

    expect(mockCallback).toHaveBeenCalledWith(
      'sqs-message-id',
      snsMessage,
      logger
    )
  })
})
