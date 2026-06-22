import { config } from '#~/config/index.js'

import { createServer } from '#~/server.js'

async function startServer() {
  const server = await createServer()
  await server.start()

  server.logger.info(
    `Feature flags: ${JSON.stringify(config.get('featureFlags'), null, 2)}`
  )
  server.logger.info(
    `Disabled scheme codes: ${JSON.stringify(config.get('disabledSchemeCodes'), null, 2)}`
  )
  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your backend on http://localhost:${config.get('port')}`
  )

  return server
}

export { startServer }
