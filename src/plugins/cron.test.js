import { describe, it, expect, vi, beforeEach } from 'vitest'

// import the mocks so we can inspect them in our tests
import { Cron } from 'croner'
import {
  processDailyPayments,
  processStaleLockedPayments
} from '#~/common/helpers/payment-processor.js'
import { getStats } from '#~/common/helpers/get-stats.js'
import { cron } from './cron.js'
import { metricsCounter } from '#~/common/helpers/metrics.js'

vi.mock('croner', () => ({
  Cron: vi.fn()
}))

vi.mock('#~/common/helpers/payment-processor.js', () => ({
  processDailyPayments: vi.fn(),
  processStaleLockedPayments: vi.fn()
}))

vi.mock('#~/common/helpers/get-stats.js', () => ({
  getStats: vi.fn().mockResolvedValue({
    grants: 9,
    accounts: 8,
    payments: {
      total: 7,
      pending: {
        total: 6,
        overdue: 5
      },
      locked: 4,
      submitted: 3,
      cancelled: 2,
      failed: 1
    }
  })
}))

vi.mock('#~/common/helpers/metrics.js', () => ({
  metricsCounter: vi.fn()
}))

describe('cron plugin', () => {
  let mockServer

  beforeEach(() => {
    mockServer = {
      logger: {
        info: vi.fn()
      }
    }
    vi.clearAllMocks()
  })

  it('registers itself and schedules the daily task', () => {
    cron.plugin.register(mockServer)

    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'Registering cron plugin'
    )
    expect(Cron).toHaveBeenCalledWith(
      '10 0 * * *',
      { timezone: 'UTC' },
      expect.any(Function)
    )
    expect(Cron).toHaveBeenCalledWith(
      '20 0 * * *',
      { timezone: 'UTC' },
      expect.any(Function)
    )

    expect(mockServer.logger.info).toHaveBeenCalledWith(
      `Cron jobs scheduled: ${JSON.stringify(
        {
          dailyPaymentScheduleCron: '10 0 * * *',
          staleLockedPaymentCleanupScheduleCron: '20 0 * * *',
          statsScheduleCron: '0 7 * * *',
          options: {
            timezone: 'UTC'
          }
        },
        null,
        2
      )}`
    )
  })

  it('calls processDailyPayments when the scheduled callback runs', async () => {
    processDailyPayments.mockResolvedValue({
      results: ['res1', 'res2'],
      fetchDuration: '10.00',
      processDuration: '20.00',
      sendDuration: '5.00'
    })
    cron.plugin.register(mockServer)

    // capture the callback that was passed to Cron constructor and execute it
    const scheduledFn = Cron.mock.calls[0][2]
    await scheduledFn()

    expect(processDailyPayments).toHaveBeenCalledWith(mockServer)
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'Processed 2 daily payment(s) (fetch: 10.00ms, process: 20.00ms, send: 5.00ms)'
    )
  })

  it('calls processStaleLockedPayments when the stale cleanup callback runs', () => {
    cron.plugin.register(mockServer)

    // capture the second callback
    const staleCleanupFn = Cron.mock.calls[1][2]
    staleCleanupFn()

    expect(processStaleLockedPayments).toHaveBeenCalledWith(mockServer)
  })

  it('calls getStats when the stats callback runs', async () => {
    cron.plugin.register(mockServer)

    // capture the second callback
    const statsFn = Cron.mock.calls[2][2]
    await statsFn()

    expect(getStats).toHaveBeenCalled()
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      `Stats: ${JSON.stringify(
        {
          grants: 9,
          accounts: 8,
          payments: {
            total: 7,
            pending: {
              total: 6,
              overdue: 5
            },
            locked: 4,
            submitted: 3,
            cancelled: 2,
            failed: 1
          }
        },
        null,
        2
      )}`
    )
  })

  it('calls metricsCounter for each stat when the stats callback runs', async () => {
    cron.plugin.register(mockServer)

    // capture the second callback
    const statsFn = Cron.mock.calls[2][2]
    await statsFn()

    expect(metricsCounter).toHaveBeenCalledWith('GrantsCount', 9)
    expect(metricsCounter).toHaveBeenCalledWith('AccountsCount', 8)
    expect(metricsCounter).toHaveBeenCalledWith('PaymentsTotalCount', 7)
    expect(metricsCounter).toHaveBeenCalledWith('PaymentsPendingCount', 6)
    expect(metricsCounter).toHaveBeenCalledWith('PaymentsOverdueCount', 5)
    expect(metricsCounter).toHaveBeenCalledWith('PaymentsLockedCount', 4)
    expect(metricsCounter).toHaveBeenCalledWith('PaymentsSubmittedCount', 3)
    expect(metricsCounter).toHaveBeenCalledWith('PaymentsCancelledCount', 2)
    expect(metricsCounter).toHaveBeenCalledWith('PaymentsFailedCount', 1)
  })
})
