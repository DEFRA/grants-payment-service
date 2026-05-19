import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mocks
const updateManyMock = vi.fn()
const onceMock = vi.fn()

vi.mock('#~/api/common/models/grant_payments.js', () => ({
  default: { updateMany: updateManyMock }
}))

const mockConfig = { get: vi.fn(() => '2026-05-15') }
vi.mock('#~/config/index.js', () => ({ config: mockConfig }))

const mongooseMock = {
  default: { connection: { readyState: 1, once: onceMock } }
}
vi.mock('mongoose', () => mongooseMock)

describe('data-migration plugin', () => {
  let dataMigration

  beforeEach(async () => {
    vi.clearAllMocks()
    mongooseMock.default.connection.readyState = 1
    mongooseMock.default.connection.once = onceMock
    const mod = await import('./data-migration.js')
    dataMigration = mod.dataMigration
  })

  it('calls updateMany with expected filter and arrayFilters when connected', async () => {
    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }

    updateManyMock.mockResolvedValue({ modifiedCount: 2 })

    await dataMigration.plugin.register(fakeServer)

    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'Registering data-migration plugin'
    )
    expect(updateManyMock).toHaveBeenCalled()

    const [filter, update, options] = updateManyMock.mock.calls[0]
    expect(filter).toEqual({
      'grants.payments.dueDate': '2026-05-15',
      'grants.payments.status': 'failed'
    })
    expect(update).toEqual({
      $set: { 'grants.$[].payments.$[p].status': 'submitted' }
    })
    expect(options).toEqual({
      arrayFilters: [{ 'p.dueDate': '2026-05-15', 'p.status': 'failed' }]
    })

    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      { modifiedCount: 2 },
      'data-migration: update result'
    )
  })

  it('waits for mongoose connection when not ready', async () => {
    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    mongooseMock.default.connection.readyState = 0
    onceMock.mockImplementation((event, handler) => {
      if (event === 'connected') {
        handler()
      }
    })
    updateManyMock.mockResolvedValue({ modifiedCount: 1 })

    await dataMigration.plugin.register(fakeServer)

    expect(onceMock).toHaveBeenCalledWith('connected', expect.any(Function))
    expect(updateManyMock).toHaveBeenCalled()
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      { modifiedCount: 1 },
      'data-migration: update result'
    )
  })

  it('logs an error when updateMany rejects', async () => {
    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    const error = new Error('update failed')
    updateManyMock.mockRejectedValue(error)

    await dataMigration.plugin.register(fakeServer)

    expect(fakeServer.logger.error).toHaveBeenCalledWith(
      error,
      'data-migration: migration failed'
    )
  })
})
