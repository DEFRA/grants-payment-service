import { CronJob } from 'cron'
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

      CronJob.from({
        cronTime: config.get('cron.dailyPaymentSchedule'),
        onTick: () => processDailyPayments(server),
        start: true,
        timeZone: 'Europe/London'
      })

      CronJob.from({
        cronTime: config.get('cron.staleLockedPaymentCleanupSchedule'),
        onTick: () => processStaleLockedPayments(server),
        start: true,
        timeZone: 'Europe/London'
      })
    }
  }
}

export { cron }
