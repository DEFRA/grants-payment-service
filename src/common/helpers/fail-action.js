import { getLogger } from '#~/common/helpers/logging/logger.js'

const logger = getLogger()

/**
 * Hapi failAction handler used to fail route validation.
 * @param {import('@hapi/hapi').Request} _request
 * @param {import('@hapi/hapi').ResponseToolkit} _h
 * @param {Error | undefined} error
 * @returns {never}
 */
export function failAction(_request, _h, error) {
  logger.warn(error, error?.message)
  throw error ?? new Error('Validation failed')
}
