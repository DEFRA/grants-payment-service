import { config } from '#~/config/index.js'

import { createServiceBusSubscriptionPlugin } from './service-bus-subscription-plugin.js'

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn()
  }
}))

const mockConfigGet = (key) => {
  switch (key) {
    case 'serviceBus.baseUrl':
      return 'http://localhost:3001'
    case 'serviceBus.batchRejected.subscription':
      return 'grants-payment-service'
    case 'serviceBus.pollIntervalMs':
      return 5000
    case 'serviceBus.errorBackoffMs':
      return 10000
    default:
      return undefined
  }
}

const ok = (body, extra = {}) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: () => Promise.resolve(body),
  ...extra
})

const noContent = () => ({
  ok: true,
  status: 204,
  headers: { get: () => null },
  json: () => Promise.resolve(null)
})

describe('createServiceBusSubscriptionPlugin', () => {
  let server
  let originalFetch

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    originalFetch = globalThis.fetch
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

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.useRealTimers()
  })

  const getStopHandler = () =>
    server.events.on.mock.calls.find((call) => call[0] === 'stop')?.[1]

  it('registers a poller for the configured subscription', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(noContent())

    const handler = vi.fn()
    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })

    await plugin.register(server)
    getStopHandler()?.()

    expect(server.logger.info).toHaveBeenCalledWith(
      'Setting up Service Bus HTTP poller (batch-rejected) for subscription: grants-payment-service'
    )
    expect(server.events.on).toHaveBeenCalledWith('stop', expect.any(Function))
  })

  it('throws when the base URL is not set', () => {
    config.get.mockImplementation((key) =>
      key === 'serviceBus.baseUrl' ? null : undefined
    )

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler: vi.fn()
    })

    expect(() => plugin.register(server)).toThrow(
      'serviceBus.baseUrl is not set'
    )
  })

  it('polls for messages, processes them, and completes via DELETE', async () => {
    const handler = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ok(
          {
            messageId: 'msg-123',
            body: { type: 'BATCH_REJECTED', data: { batchId: 'b1' } },
            subject: 'BATCH_REJECTED'
          },
          {
            headers: { get: (h) => (h === 'x-lock-token' ? 'lock-abc' : null) }
          }
        )
      )
      .mockResolvedValueOnce(ok({ message: 'Message completed' }))
      .mockResolvedValue(noContent())

    globalThis.fetch = fetchMock

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })
    await plugin.register(server)

    await vi.advanceTimersByTimeAsync(0)

    expect(handler).toHaveBeenCalledWith(
      'msg-123',
      { type: 'BATCH_REJECTED', data: { batchId: 'b1' } },
      server.logger
    )

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/servicebus/subscriptions/grants-payment-service/messages/head'
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/servicebus/subscriptions/grants-payment-service/messages/lock-abc',
      { method: 'DELETE' }
    )

    getStopHandler()?.()
    await vi.advanceTimersByTimeAsync(5000)
  })

  it('abandons the message when the handler throws', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('handler failed'))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ok(
          { messageId: 'msg-456', body: { type: 'BATCH_REJECTED' } },
          {
            headers: { get: (h) => (h === 'x-lock-token' ? 'lock-xyz' : null) }
          }
        )
      )
      .mockResolvedValue(ok({ message: 'Message abandoned' }))
      .mockResolvedValue(noContent())

    globalThis.fetch = fetchMock

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })
    await plugin.register(server)

    await vi.advanceTimersByTimeAsync(0)

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/servicebus/subscriptions/grants-payment-service/messages/lock-xyz/abandon',
      { method: 'POST' }
    )
    expect(server.logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      'Service Bus subscription (batch-rejected) error: handler failed'
    )

    getStopHandler()?.()
    await vi.advanceTimersByTimeAsync(5000)
  })

  it('uses a fallback message id when messageId is missing', async () => {
    const handler = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ok(
          { body: { type: 'BATCH_REJECTED' } },
          {
            headers: { get: (h) => (h === 'x-lock-token' ? 'lock-1' : null) }
          }
        )
      )
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValue(noContent())

    globalThis.fetch = fetchMock

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler
    })
    await plugin.register(server)

    await vi.advanceTimersByTimeAsync(0)

    expect(handler).toHaveBeenCalledWith(
      'unknown-message-id',
      { type: 'BATCH_REJECTED' },
      server.logger
    )

    getStopHandler()?.()
    await vi.advanceTimersByTimeAsync(5000)
  })

  it('logs an error when message body is missing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ok(
          { messageId: 'msg-1', body: undefined },
          {
            headers: { get: (h) => (h === 'x-lock-token' ? 'lock-2' : null) }
          }
        )
      )
      .mockResolvedValue(ok({}))

    globalThis.fetch = fetchMock

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler: vi.fn()
    })
    await plugin.register(server)

    await vi.advanceTimersByTimeAsync(0)

    expect(server.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Service Bus message missing body for message msg-1'
      }),
      expect.stringContaining('Service Bus subscription (batch-rejected) error')
    )

    getStopHandler()?.()
    await vi.advanceTimersByTimeAsync(5000)
  })

  it('logs an error when message body is invalid JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ok(
          { messageId: 'msg-2', body: '{ not: "json"' },
          {
            headers: { get: (h) => (h === 'x-lock-token' ? 'lock-3' : null) }
          }
        )
      )
      .mockResolvedValue(ok({}))

    globalThis.fetch = fetchMock

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler: vi.fn()
    })
    await plugin.register(server)

    await vi.advanceTimersByTimeAsync(0)

    expect(server.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid message format for message msg-2'
      }),
      expect.stringContaining('Service Bus subscription (batch-rejected) error')
    )

    getStopHandler()?.()
    await vi.advanceTimersByTimeAsync(5000)
  })

  it('logs an error when the poll endpoint returns an unexpected status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: () => Promise.resolve({})
    })

    globalThis.fetch = fetchMock

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler: vi.fn()
    })
    await plugin.register(server)

    await vi.advanceTimersByTimeAsync(0)

    expect(server.logger.error).toHaveBeenCalledWith(
      'Service Bus HTTP poller (batch-rejected) unexpected status: 500'
    )

    getStopHandler()?.()
    await vi.advanceTimersByTimeAsync(5000)
  })

  it('stops polling on server stop', async () => {
    const fetchMock = vi.fn().mockResolvedValue(noContent())
    globalThis.fetch = fetchMock

    const { plugin } = createServiceBusSubscriptionPlugin({
      tag: 'batch-rejected',
      handler: vi.fn()
    })
    await plugin.register(server)

    await vi.advanceTimersByTimeAsync(0)
    const callsAfterFirstPoll = fetchMock.mock.calls.length

    getStopHandler()?.()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(fetchMock.mock.calls.length).toBe(callsAfterFirstPoll)
  })
})
