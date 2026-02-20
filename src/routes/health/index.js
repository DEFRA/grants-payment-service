import mongoose from 'mongoose'

import { config } from '#~/config.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

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
          error: e.message,
          version: config.get('serviceVersion')
        })
        .code(statusCodes.serviceUnavailable)
    }

    return h.response({
      message: 'success',
      version: config.get('serviceVersion') ?? 'dev'
    })
  }
}

export { health }
