import models from '#~/api/common/models/index.js'
import { getLogger } from '#~/common/helpers/logging/logger.js'

/**
 * Syncs indexes for all Mongoose models with their schema definitions.
 * This ensures indexes defined in schemas are created in the database.
 *
 * @param {string} [logPrefix='sync-model-indexes'] - Optional prefix for log messages
 */
export const syncModelIndexes = async (logPrefix = 'sync-model-indexes') => {
  const logger = getLogger()
  logger.info(`${logPrefix}: syncing MongoDB indexes`)

  for (const [modelName, model] of Object.entries(models)) {
    try {
      await model.syncIndexes()
      logger.info(`${logPrefix}: synced MongoDB indexes for ${modelName}`)
    } catch (error) {
      logger.error(
        error,
        `${logPrefix}: failed to sync MongoDB indexes for ${modelName}`
      )

      return error
    }
  }
  logger.info(`${logPrefix}: all indexes synced successfully`)

  return true
}
