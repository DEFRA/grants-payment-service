import { describe, it, expect, vi, beforeEach } from 'vitest'

// import the mocks so we can inspect them in our tests
import { CronJob } from 'cron'
import {
  processDailyPayments,
  processStaleLockedPayments
} from '#~/common/helpers/payment-processor.js'
import { cron } from './cron.js'

vi.mock('cron', () => ({
  CronJob: {
    from: vi.fn()
  }
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
    expect(CronJob.from).toHaveBeenCalledWith(
      expect.objectContaining({
        cronTime: '10 0 * * *',
        onTick: expect.any(Function),
        start: true,
        timeZone: 'Europe/London'
      })
    )
    expect(CronJob.from).toHaveBeenCalledWith(
      expect.objectContaining({
        cronTime: '20 0 * * *',
        onTick: expect.any(Function),
        start: true,
        timeZone: 'Europe/London'
      })
    )
  })

  it('calls processDailyPayments when the scheduled callback runs', () => {
    cron.plugin.register(mockServer)

    // capture the callback that was passed to onTick and execute it
    const scheduledFn = CronJob.from.mock.calls[0][0].onTick
    scheduledFn()

    expect(processDailyPayments).toHaveBeenCalledWith(mockServer)
  })

  it('calls processStaleLockedPayments when the stale cleanup callback runs', () => {
    cron.plugin.register(mockServer)

    // capture the second callback
    const staleCleanupFn = CronJob.from.mock.calls[1][0].onTick
    staleCleanupFn()

    expect(processStaleLockedPayments).toHaveBeenCalledWith(mockServer)
  })
})
