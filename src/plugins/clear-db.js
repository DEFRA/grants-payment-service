import { config } from '#~/config/index.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

const clearDb = {
  plugin: {
    name: 'clear-db',
    register: async (server) => {
      server.logger.info('Registering clear-db plugin')

      const isClearDbEnabled = config.get('featureFlags.clearDbOnStartup')

      if (!isClearDbEnabled) {
        server.logger.info('Clear DB on startup is disabled')
        return
      }

      server.logger.warn(
        'Clear DB on startup is enabled - deleting all grant payments data'
      )

      try {
        const result = await GrantPaymentsModel.deleteMany({})
        server.logger.info(
          `Deleted ${result.deletedCount} grant payment document(s)`
        )
      } catch (error) {
        server.logger.error(
          { error },
          'Failed to clear grant payments data on startup'
        )
        throw error
      }
    }
  }
}

export { clearDb }
