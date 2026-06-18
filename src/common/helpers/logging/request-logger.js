import hapiPino from 'hapi-pino'

import { loggerOptions } from '#~/common/helpers/logging/logger-options.js'
import { config } from '#~/config/index.js'

const requestLoggerDebugEnabled =
  config.get('featureFlags.requestLoggerDebug') === true
const isInteractive = process.stdout.isTTY

// Custom message function that includes payloads in the log message
const customRequestCompleteMessage = (request, responseTime) => {
  let message = `[response] ${request.method} ${request.raw.req.url} ${request.raw.res.statusCode} (${responseTime}ms)`

  try {
    const filteredHeaders = Object.entries(request.headers).reduce(
      (acc, [key, value]) => {
        if (key !== 'x-api-key') {
          acc[key] = value
        }
        return acc
      },
      {}
    )

    if (Object.keys(filteredHeaders).length > 0) {
      message += `\n headers: ${JSON.stringify(filteredHeaders, null, 2)}`
    }

    if (request?.payload) {
      message += `\n request body: ${JSON.stringify(request.payload, null, 2)}`
    }
    if (request?.response?.source) {
      message += `\n response: ${JSON.stringify(request.response.source, null, 2)}`
    }
  } catch {}

  return message
}

const requestLogger = {
  plugin: hapiPino,
  options: {
    ...loggerOptions,
    ...(requestLoggerDebugEnabled && !isInteractive
      ? { customRequestCompleteMessage }
      : {})
  }
}

export { requestLogger }
