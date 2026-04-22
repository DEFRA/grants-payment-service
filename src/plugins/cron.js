import { Cron } from 'croner'
import {
  processDailyPayments,
  processStaleLockedPayments
} from '#~/common/helpers/payment-processor.js'
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
        )
      }
    }
  }
}

export { cron }
