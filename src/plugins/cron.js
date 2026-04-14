import cronJob from 'node-cron'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'
import { config } from '#~/config/index.js'

const cron = {
  plugin: {
    name: 'cron',
    register: (server) => {
      server.logger.info('Registering cron plugin')

      cronJob.schedule(config.get('cronDailyPaymentSchedule'), () =>
        processDailyPayments(server)
      )
    }
  }
}

export { cron }
