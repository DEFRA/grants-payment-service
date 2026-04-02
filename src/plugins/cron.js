import cronJob from 'node-cron'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'

const cron = {
  plugin: {
    name: 'cron',
    register: (server) => {
      server.logger.info('Registering cron plugin')

      // Run Payment Service tasks at 00:10 to avoid missing runs when winter/summer timezone changes
      cronJob.schedule('10 0 * * *', () => processDailyPayments(server))
    }
  }
}

export { cron }
