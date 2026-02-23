import { config } from '#~/config.js'
import { health } from '#~/routes/health/index.js'
import { testEndpoints } from '#~/routes/test-endpoints/index.js'

const router = {
  plugin: {
    name: 'router',
    register: async (server, _options) => {
      server.route([health])

      if (config.get('featureFlags.testEndpoints') === true) {
        server.logger.warn(
          'Test endpoints are enabled. These should not be used in production.'
        )
        await server.register([testEndpoints])
      }
    }
  }
}

export { router }
