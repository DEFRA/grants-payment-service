import { describe, it, expect, beforeEach, vi } from 'vitest'
import { postSyncDbIndexesController } from './post-sync-db-indexes.controller.js'

vi.mock('#~/common/helpers/sync-model-indexes.js', () => ({
  syncModelIndexes: vi.fn().mockResolvedValue(undefined)
}))

describe('postSyncDbIndexesController', () => {
  let mockRequest
  let mockResponseToolkit

  beforeEach(() => {
    mockRequest = {
      logger: {
        info: vi.fn(),
        error: vi.fn()
      }
    }
    mockResponseToolkit = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  it('should sync indexes successfully', async () => {
    const { syncModelIndexes } =
      await import('#~/common/helpers/sync-model-indexes.js')

    await postSyncDbIndexesController.handler(mockRequest, mockResponseToolkit)

    expect(syncModelIndexes).toHaveBeenCalledWith('test-endpoint')
    expect(mockRequest.logger.info).toHaveBeenCalledWith(
      'Syncing MongoDB indexes'
    )
    expect(mockRequest.logger.info).toHaveBeenCalledWith(
      'Successfully synced MongoDB indexes'
    )
    expect(mockResponseToolkit.response).toHaveBeenCalledWith({
      message: 'MongoDB indexes synced successfully'
    })
    expect(mockResponseToolkit.code).toHaveBeenCalledWith(200)
  })

  it('should handle errors when syncing indexes fails', async () => {
    const { syncModelIndexes } =
      await import('#~/common/helpers/sync-model-indexes.js')
    const testError = new Error('Sync failed')
    syncModelIndexes.mockRejectedValue(testError)

    await postSyncDbIndexesController.handler(mockRequest, mockResponseToolkit)

    expect(mockRequest.logger.error).toHaveBeenCalledWith(
      testError,
      'Error syncing MongoDB indexes'
    )
    expect(mockResponseToolkit.response).toHaveBeenCalledWith({
      message: 'Failed to sync MongoDB indexes',
      error: 'Sync failed'
    })
    expect(mockResponseToolkit.code).toHaveBeenCalledWith(500)
  })
})
