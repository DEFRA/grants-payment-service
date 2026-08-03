import { getLogger } from '#~/common/helpers/logging/logger.js'

const logger = getLogger()

export function failAction(_request, _h, error) {
  logger.warn(error, error?.message)
  throw error
}
