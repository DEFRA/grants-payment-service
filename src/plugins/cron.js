import { Cron } from 'croner'
import {
  processDailyPayments,
  processStaleLockedPayments
} from '#~/common/helpers/payment-processor.js'
import { getStats } from '#~/common/helpers/get-stats.js'
import { config } from '#~/config/index.js'

const cron = {
  plugin: {
    name: 'cron',
    register: (server) => {
      server.logger.info('Registering cron plugin')

      const options = { timezone: config.get('cron.timezone') }

      const dailyPaymentScheduleCron = config.get('cron.dailyPaymentSchedule')
      const dailyPaymentSchedule = new Cron(
        dailyPaymentScheduleCron,

        options,
        () =>
          processDailyPayments(server).then(
            ({ results, fetchDuration, processDuration, sendDuration }) => {
              server.logger.info(
                `Processed ${results.length} daily payment(s) (fetch: ${fetchDuration}ms, process: ${processDuration}ms, send: ${sendDuration}ms)`
              )
            }
          )
      )

      const staleLockedPaymentCleanupScheduleCron = config.get(
        'cron.staleLockedPaymentCleanupSchedule'
      )
      const staleLockedPaymentCleanupSchedule = new Cron(
        staleLockedPaymentCleanupScheduleCron,
        options,
        () => processStaleLockedPayments(server)
      )

      const statsScheduleCron = config.get('cron.statsSchedule')
      const statsSchedule = new Cron(statsScheduleCron, options, async () => {
        const stats = await getStats()
        server.logger.info(`Stats: ${JSON.stringify(stats, null, 2)}`)
      })

      server.logger.info(
        `Cron jobs scheduled: ${JSON.stringify(
          {
            dailyPaymentScheduleCron,
            staleLockedPaymentCleanupScheduleCron,
            statsScheduleCron,
            options
          },
          null,
          2
        )}`
      )

      return {
        dailyPaymentSchedule,
        staleLockedPaymentCleanupSchedule,
        statsSchedule
      }
    }
  }
}

export { cron }
