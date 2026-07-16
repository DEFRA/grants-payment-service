import { Cron } from 'croner'
import {
  processDailyPayments,
  processStaleLockedPayments
} from '#~/common/helpers/payment-processor.js'
import { getStats } from '#~/common/helpers/get-stats.js'
import { config } from '#~/config/index.js'
import { Metrics } from '@defra/cdp-metrics'

const cron = {
  plugin: {
    name: 'cron',
    register: (server) => {
      server.logger.info('Registering cron plugin')

      const options = { timezone: config.get('cron.timezone') }
      const metrics = new Metrics(server.logger)

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

        await Promise.all([
          metrics.counter('AccountsCount', Number(stats.accounts)),
          metrics.counter('GrantsCount', Number(stats.grants)),
          metrics.counter('PaymentsTotalCount', Number(stats.payments.total)),
          metrics.counter(
            'PaymentsPendingCount',
            Number(stats.payments.pending.total)
          ),
          metrics.counter('PaymentsLockedCount', Number(stats.payments.locked)),
          metrics.counter(
            'PaymentsSubmittedCount',
            Number(stats.payments.submitted)
          ),
          metrics.counter(
            'PaymentsOverdueCount',
            Number(stats.payments.pending.overdue)
          ),
          metrics.counter(
            'PaymentsCancelledCount',
            Number(stats.payments.cancelled)
          ),
          metrics.counter('PaymentsFailedCount', Number(stats.payments.failed))
        ])
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
