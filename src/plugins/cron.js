import cronJob from 'node-cron'
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

      cronJob.schedule(config.get('cron.dailyPaymentSchedule'), () =>
        processDailyPayments(server).then(
          ({ results, fetchDuration, processDuration }) => {
            server.logger.info(
              `Processed ${results.length} daily payment(s) (fetch: ${fetchDuration}ms, process: ${processDuration}ms)`
            )
          }
        )
      )

      cronJob.schedule(
        config.get('cron.staleLockedPaymentCleanupSchedule'),
        () => processStaleLockedPayments(server)
      )
    }
  }
}

export { cron }
