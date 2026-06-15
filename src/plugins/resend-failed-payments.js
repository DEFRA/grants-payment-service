import mongoose from 'mongoose'
import GrantPayments from '#~/api/common/models/grant_payments.js'
import { config } from '#~/config/index.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'
import { getStats } from '#~/common/helpers/get-stats.js'

const pluginName = 'resend-failed-payments'

const updateFailedPaymentsToPending = async (server) => {
  const result = await GrantPayments.updateMany(
    {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: {
              status: 'failed'
            }
          }
        }
      }
    },
    {
      $set: {
        'grants.$[].payments.$[p].status': 'pending',
        'grants.$[].payments.$[p].updatedAt': new Date()
      }
    },
    {
      arrayFilters: [
        {
          'p.status': 'failed'
        }
      ]
    }
  )

  server.logger.info(
    `${pluginName}: updated ${result.modifiedCount} failed payment(s) to pending`
  )

  return result.modifiedCount
}

const runResendFailedPayments = async (server) => {
  const updatedCount = await updateFailedPaymentsToPending(server)

  if (updatedCount > 0) {
    server.logger.info(
      `${pluginName}: triggering processDailyPayments to process updated payments`
    )
    await processDailyPayments(server)

    const stats = await getStats()
    server.logger.info(
      `${pluginName}: Stats: ${JSON.stringify(stats, null, 2)}`
    )
  } else {
    server.logger.info(`${pluginName}: no failed payments found to resend`)
  }
}

const resendFailedPayments = {
  plugin: {
    name: pluginName,
    register: async (server) => {
      if (config.get('featureFlags.resendFailedPaymentsEnabled') !== true) {
        return
      }

      server.logger.info(`${pluginName}: Registering plugin`)

      const execute = async () => {
        try {
          await runResendFailedPayments(server)
        } catch (error) {
          server.logger.error(
            error,
            `${pluginName}: resend failed payments failed`
          )
        }
      }

      if (mongoose.connection?.readyState === 1) {
        await execute()
      } else {
        mongoose.connection.once('connected', async () => {
          await execute()
        })
      }
    }
  }
}

export { resendFailedPayments }
