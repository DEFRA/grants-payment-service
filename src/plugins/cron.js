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

      return {
        dailyPaymentSchedule: new Cron(
          config.get('cron.dailyPaymentSchedule'),
          options,
          () =>
            processDailyPayments(server).then(
              ({ results, fetchDuration, processDuration, sendDuration }) => {
                server.logger.info(
                  `Processed ${results.length} daily payment(s) (fetch: ${fetchDuration}ms, process: ${processDuration}ms, send: ${sendDuration}ms)`
                )
              }
            )
        ),
        staleLockedPaymentCleanupSchedule: new Cron(
          config.get('cron.staleLockedPaymentCleanupSchedule'),
          options,
          () => processStaleLockedPayments(server)
        ),
        statsSchedule: new Cron(
          config.get('cron.statsSchedule'),
          options,
          async () => {
            const stats = await getStats()
            server.logger.info(`Stats: ${JSON.stringify(stats, null, 2)}`)
          }
        )
      }
    }
  }
}

export { cron }
