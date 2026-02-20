import { health } from '../routes/health/index.js'
import { testEndpoints } from '../api/test-endpoints/index.js'

const router = {
  plugin: {
    name: 'router',
    register: async (server, _options) => {
      server.route([health])

      await server.register([testEndpoints])
    }
  }
}

export { router }
