import { pino } from 'pino'

import { loggerOptions } from '#~/common/helpers/logging/logger-options.js'

const logger = pino(loggerOptions)

/**
 * Returns the pino logger instance
 * @returns {import('pino').Logger} The pino logger instance
 */
function getLogger() {
  return logger
}

export { getLogger }
