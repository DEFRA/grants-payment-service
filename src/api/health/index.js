import mongoose from 'mongoose'

import { config } from '#~/config/index.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import GrantPayments from '#~/api/common/models/grant_payments.js'

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
      featureFlags: config.get('featureFlags')
    })
  }
}

const stats = {
  method: 'GET',
  path: '/health/stats',
  handler: async (_request, h) => {
    try {
      const accounts = await GrantPayments.countDocuments()

      const grantStats = await GrantPayments.aggregate([
        { $unwind: '$grants' },
        { $group: { _id: null, count: { $sum: 1 } } }
      ])

      const grants = grantStats.length > 0 ? grantStats[0].count : 0

      const paymentStats = await GrantPayments.aggregate([
        { $unwind: '$grants' },
        { $unwind: '$grants.payments' },
        { $group: { _id: '$grants.payments.status', count: { $sum: 1 } } }
      ])

      let totalPayments = 0
      const statusCounts = {
        pending: 0,
        submitted: 0,
        cancelled: 0,
        locked: 0,
        failed: 0
      }

      paymentStats.forEach((stat) => {
        statusCounts[stat._id] = stat.count
        totalPayments += stat.count
      })

      return h.response({
        stats: {
          accounts,
          grants,
          payments: {
            total: totalPayments,
            ...statusCounts
          }
        }
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
