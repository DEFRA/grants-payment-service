import {
  ServiceBusClient,
  __mockClient,
  __mockReceiver,
  __mockSubscriptionInstance,
  __mockHandlers
} from '@azure/service-bus'

import { config } from '#~/config/index.js'

import { createServiceBusSubscriptionPlugin } from './service-bus-subscription-plugin.js'

vi.mock('@azure/service-bus', () => {
  const mockSubscriptionInstance = { close: vi.fn() }
  const mockHandlers = {}
  const mockReceiver = {
    subscribe: vi.fn((handlers) => {
      Object.assign(mockHandlers, handlers)
      return mockSubscriptionInstance
    }),
    close: vi.fn()
  }
  const mockClient = {
    createReceiver: vi.fn(() => mockReceiver),
    close: vi.fn()
  }
  return {
    ServiceBusClient: vi.fn(function () {
      return mockClient
    }),
    __mockClient: mockClient,
    __mockReceiver: mockReceiver,
    __mockSubscriptionInstance: mockSubscriptionInstance,
    __mockHandlers: mockHandlers
  }
})

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn()
  }
}))

const mockConfigGet = (key) => {
  switch (key) {
    case 'serviceBus.connectionString':
      return 'Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true'
    case 'serviceBus.batchRejected.topic':
      return 'ffc-pay-request-response-dev'
    case 'serviceBus.batchRejected.subscription':
      return 'grants-payment-service'
    default:
      return undefined
  }
}

describe('createServiceBusSubscriptionPlugin', () => {
  let server

  beforeEach(() => {
    vi.clearAllMocks()
    config.get.mockImplementation(mockConfigGet)

    server = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      events: {
        on: vi.fn()
      }
    }
  })

  it('creates a receiver for the configured topic and subscription', async () => {
    const handler = vi.fn()

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })

    await plugin.register(server)

    expect(ServiceBusClient).toHaveBeenCalledWith(
      'Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true'
    )
    expect(__mockClient.createReceiver).toHaveBeenCalledWith(
      'ffc-pay-request-response-dev',
      'grants-payment-service',
      { receiveMode: 'peekLock' }
    )
    expect(__mockReceiver.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        processMessage: expect.any(Function),
        processError: expect.any(Function)
      })
    )
    expect(server.events.on).toHaveBeenCalledWith('stop', expect.any(Function))
  })

  it('closes the subscription, receiver and client on server stop', async () => {
    const handler = vi.fn()

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })

    await plugin.register(server)

    const stopHandler = server.events.on.mock.calls.find(
      (call) => call[0] === 'stop'
    )[1]

    stopHandler()

    await vi.waitFor(() => {
      expect(__mockSubscriptionInstance.close).toHaveBeenCalled()
      expect(__mockReceiver.close).toHaveBeenCalled()
      expect(__mockClient.close).toHaveBeenCalled()
    })
  })

  it('throws when the connection string is not set', () => {
    config.get.mockImplementation((key) =>
      key === 'serviceBus.connectionString' ? null : undefined
    )

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler: vi.fn()
    })

    expect(() => plugin.register(server)).toThrow(
      'serviceBus.connectionString is not set'
    )
  })

  it('parses and processes a JSON string message body', async () => {
    const handler = vi.fn()
    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })
    await plugin.register(server)

    const payload = { type: 'BATCH_REJECTED', data: { batchId: 'batch-1' } }
    const message = {
      messageId: 'msg-123',
      body: JSON.stringify(payload)
    }

    await __mockHandlers.processMessage(message)

    expect(handler).toHaveBeenCalledWith('msg-123', payload, server.logger)
    expect(server.logger.info).toHaveBeenCalledWith(
      'Service Bus subscription (batch-rejected) handling message (MessageId: msg-123)'
    )
    expect(server.logger.info).toHaveBeenCalledWith(
      'Service Bus subscription (batch-rejected) message processed successfully (MessageId: msg-123)'
    )
  })

  it('processes an object message body directly', async () => {
    const handler = vi.fn()
    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })
    await plugin.register(server)

    const payload = { type: 'BATCH_REJECTED' }
    await __mockHandlers.processMessage({
      messageId: 'msg-456',
      body: payload
    })

    expect(handler).toHaveBeenCalledWith('msg-456', payload, server.logger)
  })

  it('uses a fallback message id when messageId is missing', async () => {
    const handler = vi.fn()
    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })
    await plugin.register(server)

    await __mockHandlers.processMessage({
      body: JSON.stringify({ type: 'BATCH_REJECTED' })
    })

    expect(handler).toHaveBeenCalledWith(
      'unknown-message-id',
      expect.any(Object),
      server.logger
    )
  })

  it('throws badData when message body is missing', async () => {
    const handler = vi.fn()
    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })
    await plugin.register(server)

    await expect(
      __mockHandlers.processMessage({ messageId: 'msg-1', body: undefined })
    ).rejects.toMatchObject({
      isBoom: true,
      message: 'Service Bus message missing body for message msg-1'
    })
  })

  it('throws badData when message body is invalid JSON', async () => {
    const handler = vi.fn()
    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })
    await plugin.register(server)

    await expect(
      __mockHandlers.processMessage({
        messageId: 'msg-2',
        body: '{ not: "json"'
      })
    ).rejects.toMatchObject({
      isBoom: true,
      message: 'Invalid message format for message msg-2'
    })
  })

  it('logs errors from the subscription', async () => {
    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler: vi.fn()
    })
    await plugin.register(server)

    const error = new Error('connection failed')
    await __mockHandlers.processError({ error })

    expect(server.logger.error).toHaveBeenCalledWith(
      error,
      'Service Bus subscription (batch-rejected) error: connection failed'
    )
  })
})
