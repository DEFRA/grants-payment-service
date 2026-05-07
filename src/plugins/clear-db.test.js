import { describe, it, expect, vi, beforeEach } from 'vitest'

import { clearDb } from './clear-db.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { config } from '#~/config/index.js'

vi.mock('#~/api/common/models/grant_payments.js', () => ({
  default: {
    deleteMany: vi.fn()
  }
}))

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn()
  }
}))

describe('clear-db plugin', () => {
  let mockServer

  beforeEach(() => {
    mockServer = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    }
    vi.clearAllMocks()
  })

  it('registers itself and logs when disabled', async () => {
    config.get.mockReturnValue(false)

    await clearDb.plugin.register(mockServer)

    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'Registering clear-db plugin'
    )
    expect(config.get).toHaveBeenCalledWith('featureFlags.clearDbOnStartup')
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'Clear DB on startup is disabled'
    )
    expect(GrantPaymentsModel.deleteMany).not.toHaveBeenCalled()
  })

  it('deletes all data when feature flag is enabled', async () => {
    config.get.mockReturnValue(true)
    GrantPaymentsModel.deleteMany.mockResolvedValue({ deletedCount: 5 })

    await clearDb.plugin.register(mockServer)

    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'Registering clear-db plugin'
    )
    expect(config.get).toHaveBeenCalledWith('featureFlags.clearDbOnStartup')
    expect(mockServer.logger.warn).toHaveBeenCalledWith(
      'Clear DB on startup is enabled - deleting all grant payments data'
    )
    expect(GrantPaymentsModel.deleteMany).toHaveBeenCalledWith({})
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'Deleted 5 grant payment document(s)'
    )
  })

  it('handles zero documents deleted', async () => {
    config.get.mockReturnValue(true)
    GrantPaymentsModel.deleteMany.mockResolvedValue({ deletedCount: 0 })

    await clearDb.plugin.register(mockServer)

    expect(GrantPaymentsModel.deleteMany).toHaveBeenCalledWith({})
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'Deleted 0 grant payment document(s)'
    )
  })

  it('throws error when deleteMany fails', async () => {
    config.get.mockReturnValue(true)
    const error = new Error('Database connection failed')
    GrantPaymentsModel.deleteMany.mockRejectedValue(error)

    await expect(clearDb.plugin.register(mockServer)).rejects.toThrow(
      'Database connection failed'
    )

    expect(mockServer.logger.error).toHaveBeenCalledWith(
      { error },
      'Failed to clear grant payments data on startup'
    )
  })
})
