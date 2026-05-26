import { vi, describe, it, expect, beforeEach } from 'vitest'

const findMock = vi.fn()
const deleteManyMock = vi.fn()
const syncIndexesMock = vi.fn()
const onceMock = vi.fn()
const getMock = vi.fn()

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

vi.mock('#~/config/index.js', () => ({
  config: {
    get: getMock
  }
}))

describe('remove-duplicate-grant-payments plugin', () => {
  let plugin

  beforeEach(async () => {
    vi.clearAllMocks()
    mongooseMock.default.connection.readyState = 1
    onceMock.mockReset()
    findMock.mockReset()
    deleteManyMock.mockReset()
    getMock.mockReset()
    getMock.mockImplementation((key) => {
      if (key === 'featureFlags.removeDuplicateGrantPaymentsEnabled') {
        return true
      }
      return undefined
    })
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
      'remove-duplicate-grant-payments: deleted duplicate document: _id=2, sbi=N/A, frn=N/A, claimId=N/A, createdAt=2025-01-02T00:00:00.000Z, signature=duplicate-a'
    )
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'remove-duplicate-grant-payments: kept document: _id=1, sbi=N/A, frn=N/A, claimId=N/A, createdAt=2025-01-01T00:00:00.000Z, signature=duplicate-a'
    )
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

  it('deletes the earlier document when the later duplicate is kept', async () => {
    findMock.mockReturnValue({
      lean: () => ({
        exec: async () => [
          {
            _id: '1',
            createdAt: new Date('2025-01-02'),
            grants: [{ correlationId: 'duplicate-a' }]
          },
          {
            _id: '2',
            createdAt: new Date('2025-01-01'),
            grants: [{ correlationId: 'duplicate-a' }]
          }
        ]
      })
    })
    deleteManyMock.mockResolvedValue({ deletedCount: 1 })

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(deleteManyMock).toHaveBeenCalledWith({ _id: { $in: ['1'] } })
    expect(syncIndexesMock).toHaveBeenCalled()
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'remove-duplicate-grant-payments: deleted duplicate document: _id=1, sbi=N/A, frn=N/A, claimId=N/A, createdAt=2025-01-02T00:00:00.000Z, signature=duplicate-a'
    )
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'remove-duplicate-grant-payments: kept document: _id=2, sbi=N/A, frn=N/A, claimId=N/A, createdAt=2025-01-01T00:00:00.000Z, signature=duplicate-a'
    )
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'remove-duplicate-grant-payments: deleted duplicate documents: 1'
    )
  })

  it('skips documents without a deduplication signature', async () => {
    findMock.mockReturnValue({
      lean: () => ({
        exec: async () => [
          {
            _id: '1',
            createdAt: new Date('2025-01-01'),
            grants: []
          },
          {
            _id: '2',
            createdAt: new Date('2025-01-02'),
            grants: [{ correlationId: 'unique-a' }]
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

  it('deletes duplicate documents without a correlationId even when they have different sbi, frn, or claimId', async () => {
    findMock.mockReturnValue({
      lean: () => ({
        exec: async () => [
          {
            _id: '1',
            createdAt: new Date('2025-01-01'),
            sbi: '106284736',
            frn: '12544567',
            claimId: 'R00000004',
            grants: [{}]
          },
          {
            _id: '2',
            createdAt: new Date('2025-01-02'),
            sbi: '999999999',
            frn: '88888888',
            claimId: 'R00000005',
            grants: [{}]
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
      'remove-duplicate-grant-payments: deleted duplicate document: _id=2, sbi=999999999, frn=88888888, claimId=R00000005, createdAt=2025-01-02T00:00:00.000Z, signature=no-correlation-id'
    )
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'remove-duplicate-grant-payments: kept document: _id=1, sbi=106284736, frn=12544567, claimId=R00000004, createdAt=2025-01-01T00:00:00.000Z, signature=no-correlation-id'
    )
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'remove-duplicate-grant-payments: deleted duplicate documents: 1'
    )
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

  it('does not register hooks or run deduplication if the feature flag is disabled', async () => {
    getMock.mockImplementation((key) => {
      if (key === 'featureFlags.removeDuplicateGrantPaymentsEnabled') {
        return false
      }
      return undefined
    })

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(onceMock).not.toHaveBeenCalled()
    expect(findMock).not.toHaveBeenCalled()
    expect(deleteManyMock).not.toHaveBeenCalled()
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'Registering remove-duplicate-grant-payments plugin'
    )
    expect(fakeServer.logger.info).not.toHaveBeenCalledWith(
      'remove-duplicate-grant-payments: no duplicate documents found'
    )
  })
})
