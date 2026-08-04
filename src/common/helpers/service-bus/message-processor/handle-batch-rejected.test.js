import { handleBatchRejectedEvent } from './handle-batch-rejected.js'

describe('handleBatchRejectedEvent', () => {
  const logger = {
    warn: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('logs the batch rejected event', () => {
    const payload = {
      type: 'BATCH_REJECTED',
      data: {
        batchId: 'batch-123',
        sbi: '123456789',
        frn: '9999999999'
      }
    }

    handleBatchRejectedEvent('msg-1', payload, logger)

    expect(logger.warn).toHaveBeenCalledWith(
      {
        messageId: 'msg-1',
        eventType: 'BATCH_REJECTED',
        sbi: '123456789'
      },
      expect.stringContaining('Received batch rejected event')
    )
  })

  test('logs the full payload', () => {
    const payload = {
      type: 'BATCH_REJECTED',
      data: { batchId: 'batch-456', reason: 'validation failed' }
    }

    handleBatchRejectedEvent('msg-2', payload, logger)

    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining(JSON.stringify(payload, null, 2))
    )
  })

  test('defaults event type when payload has no type', () => {
    const payload = { data: { batchId: 'batch-789' } }

    handleBatchRejectedEvent('msg-3', payload, logger)

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'BATCH_REJECTED' }),
      expect.any(String)
    )
  })
})
