import { describe, it, expect, vi, beforeEach } from 'vitest'

// import the mocks so we can inspect them in our tests
import { Cron } from 'croner'
import {
  processDailyPayments,
  processStaleLockedPayments
} from '#~/common/helpers/payment-processor.js'
import { cron } from './cron.js'

vi.mock('croner', () => ({
  Cron: vi.fn()
}))

vi.mock('#~/common/helpers/payment-processor.js', () => ({
  processDailyPayments: vi.fn(),
  processStaleLockedPayments: vi.fn()
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
      { timezone: 'Europe/London' },
      expect.any(Function)
    )
    expect(Cron).toHaveBeenCalledWith(
      '20 0 * * *',
      { timezone: 'Europe/London' },
      expect.any(Function)
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
})
