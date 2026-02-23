import Hapi from '@hapi/hapi'

import { secureContext } from '@defra/hapi-secure-context'

import { index } from '#~/config/index.js'
import { router } from '#~/plugins/router.js'
import { cron } from '#~/plugins/cron.js'
import { requestLogger } from '#~/common/helpers/logging/request-logger.js'
import { mongooseDb } from '#~/common/helpers/mongoose.js'
import { failAction } from '#~/common/helpers/fail-action.js'
import { pulse } from '#~/common/helpers/pulse.js'
import { requestTracing } from '#~/common/helpers/request-tracing.js'
import { setupProxy } from '#~/common/helpers/proxy/setup-proxy.js'
import { metrics } from '@defra/cdp-metrics'

async function createServer(serverOptions = {}) {
  const { mongoUrl, mongoDatabase } = serverOptions

  setupProxy()
  const server = Hapi.server({
    host: index.get('host'),
    port: index.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false
        },
        failAction
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    }
  })

  // Hapi Plugins:
  // requestLogger  - automatically logs incoming requests
  // requestTracing - trace header logging and propagation
  // secureContext  - loads CA certificates from environment index
  // pulse          - provides shutdown handlers
  // mongooseDb     - sets up mongoose connection pool and attaches to `server` and `request` objects
  // router         - routes used in the app
  await server.register([
    requestLogger,
    requestTracing,
    metrics,
    secureContext,
    pulse,
    {
      plugin: mongooseDb.plugin,
      options: {
        mongoUrl,
        databaseName: mongoDatabase
      }
    },
    cron,
    router
  ])

  return server
}

export { createServer }
