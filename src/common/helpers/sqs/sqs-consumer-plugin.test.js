import { describe, expect, it, vi, beforeEach } from 'vitest'

import { SQSClient } from '@aws-sdk/client-sqs'
import { Consumer } from 'sqs-consumer'

import {
  createSqsConsumerPlugin,
  processMessage
} from './sqs-consumer-plugin.js'

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
})

describe('processMessage', () => {
  const logger = {
    info: vi.fn(),
    error: vi.fn()
  }

  const baseMessage = {
    MessageId: '123',
    Body: JSON.stringify({ foo: 'bar' })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws badData when message Body is missing', async () => {
    const handler = vi.fn()

    await expect(
      processMessage(handler, { MessageId: '1' }, logger)
    ).rejects.toMatchObject({
      isBoom: true,
      message: 'SQS message missing Body'
    })
  })

  it('throws badData when message Body is invalid JSON', async () => {
    const handler = vi.fn()
    const message = {
      MessageId: '2',
      Body: '{ not: "json"'
    }

    await expect(
      processMessage(handler, message, logger)
    ).rejects.toMatchObject({
      isBoom: true,
      message: `Invalid message format: ${message.Body}`
    })
  })

  it('wraps non-SyntaxError exceptions with Boom', async () => {
    const handlerError = new Error('handler failed')
    const handler = vi.fn().mockRejectedValue(handlerError)

    await expect(
      processMessage(handler, baseMessage, logger)
    ).rejects.toMatchObject({
      isBoom: true,
      message: handlerError.message
    })
  })
})
