import mongoose from 'mongoose'

import { config } from '#~/config/index.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { getStats } from '#~/common/helpers/get-stats.js'

const health = {
  method: 'GET',
  path: '/health',
  handler: async (_request, h) => {
    try {
      if (!(await mongoose.connection.db.admin().ping()).ok) {
        throw new Error('MongoDB ping failed')
      }
    } catch (e) {
      return h
        .response({
          message: 'Unable to connect to backend MongoDB',
          error: serializeError(e),
          version: config.get('serviceVersion')
        })
        .code(statusCodes.serviceUnavailable)
    }

    return h.response({
      message: 'success',
      version: config.get('serviceVersion') ?? 'dev',
      featureFlags: config.get('featureFlags'),
      disabledActionCodes: config.get('disabledActionCodes')
    })
  }
}

const stats = {
  method: 'GET',
  path: '/health/stats',
  handler: async (_request, h) => {
    try {
      const statsData = await getStats()

      return h.response({
        stats: statsData
      })
    } catch (e) {
      return h
        .response({
          message: 'Unable to fetch stats',
          error: serializeError(e),
          version: config.get('serviceVersion')
        })
        .code(statusCodes.serviceUnavailable)
    }
  }
}

export { health, stats }
