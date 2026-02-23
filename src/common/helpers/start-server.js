import { index } from '#~/config/index.js'

import { createServer } from '#~/server.js'

async function startServer() {
  const server = await createServer()
  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your backend on http://localhost:${index.get('port')}`
  )

  return server
}

export { startServer }
