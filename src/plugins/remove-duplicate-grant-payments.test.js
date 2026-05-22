import { vi, describe, it, expect, beforeEach } from 'vitest'

const findMock = vi.fn()
const deleteManyMock = vi.fn()
const syncIndexesMock = vi.fn()
const onceMock = vi.fn()

vi.mock('#~/api/common/models/grant_payments.js', () => ({
  default: {
    find: findMock,
    deleteMany: deleteManyMock,
    syncIndexes: syncIndexesMock
  }
}))

const mongooseMock = {
  default: { connection: { readyState: 1, once: onceMock } }
}
vi.mock('mongoose', () => mongooseMock)

describe('remove-duplicate-grant-payments plugin', () => {
  let plugin

  beforeEach(async () => {
    vi.clearAllMocks()
    mongooseMock.default.connection.readyState = 1
    onceMock.mockReset()
    findMock.mockReset()
    deleteManyMock.mockReset()
    const mod = await import('./remove-duplicate-grant-payments.js')
    plugin = mod.removeDuplicateGrantPayments
  })

  it('deletes duplicate documents when the same eventCorrelationId appears more than once', async () => {
    findMock.mockReturnValue({
      lean: () => ({
        exec: async () => [
          {
            _id: '1',
            createdAt: new Date('2025-01-01'),
            grants: [{ correlationId: 'duplicate-a' }]
          },
          {
            _id: '2',
            createdAt: new Date('2025-01-02'),
            grants: [{ correlationId: 'duplicate-a' }]
          }
        ]
      })
    })
    deleteManyMock.mockResolvedValue({ deletedCount: 1 })

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(deleteManyMock).toHaveBeenCalledWith({ _id: { $in: ['2'] } })
    expect(syncIndexesMock).toHaveBeenCalled()
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'remove-duplicate-grant-payments: deleted duplicate documents: 1'
    )
  })

  it('does not delete documents when there are no duplicates', async () => {
    findMock.mockReturnValue({
      lean: () => ({
        exec: async () => [
          {
            _id: '1',
            createdAt: new Date('2025-01-01'),
            grants: [{ correlationId: 'unique-a' }]
          },
          {
            _id: '2',
            createdAt: new Date('2025-01-02'),
            grants: [{ correlationId: 'unique-b' }]
          }
        ]
      })
    })

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(deleteManyMock).not.toHaveBeenCalled()
    expect(syncIndexesMock).toHaveBeenCalled()
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'remove-duplicate-grant-payments: no duplicate documents found'
    )
  })

  it('waits for mongoose connection when not ready', async () => {
    mongooseMock.default.connection.readyState = 0
    onceMock.mockImplementation((event, handler) => {
      if (event === 'connected') {
        handler()
      }
    })
    findMock.mockReturnValue({ lean: () => ({ exec: async () => [] }) })

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(onceMock).toHaveBeenCalledWith('connected', expect.any(Function))
    expect(findMock).toHaveBeenCalled()
  })

  it('logs errors when deduplication fails', async () => {
    const error = new Error('dedupe failed')
    findMock.mockReturnValue({
      lean: () => ({
        exec: async () => {
          throw error
        }
      })
    })

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(fakeServer.logger.error).toHaveBeenCalledWith(
      error,
      'remove-duplicate-grant-payments: dedupe failed'
    )
  })
})
