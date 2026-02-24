import { health } from '#~/api/health/index.js'
import { testEndpoints } from '#~/api/test-endpoints/index.js'
import { config } from '#~/config/index.js'

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
