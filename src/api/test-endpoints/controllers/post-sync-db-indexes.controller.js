import { statusCodes } from '#~/common/constants/status-codes.js'
import { syncModelIndexes } from '#~/common/helpers/sync-model-indexes.js'

/**
 * Controller to sync MongoDB indexes
 * @satisfies {Partial<ServerRoute>}
 */
const postSyncDbIndexesController = {
  handler: async (request, h) => {
    try {
      request.logger.info('Syncing MongoDB indexes')

      await syncModelIndexes('test-endpoint')

      request.logger.info('Successfully synced MongoDB indexes')

      return h
        .response({
          message: 'MongoDB indexes synced successfully'
        })
        .code(statusCodes.ok)
    } catch (error) {
      request.logger.error(error, 'Error syncing MongoDB indexes')

      return h
        .response({
          message: 'Failed to sync MongoDB indexes',
          error: error.message
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { postSyncDbIndexesController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
