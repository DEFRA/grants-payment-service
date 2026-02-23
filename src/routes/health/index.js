import mongoose from 'mongoose'

import { index } from '#~/config/index.js'
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
          version: index.get('serviceVersion')
        })
        .code(statusCodes.serviceUnavailable)
    }

    return h.response({
      message: 'success',
      version: index.get('serviceVersion') ?? 'dev'
    })
  }
}

export { health }
