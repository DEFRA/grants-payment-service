import { describe, it, expect, vi, beforeEach } from 'vitest'

// import the mocks so we can inspect them in our tests
import cronJob from 'node-cron'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'
import { cron } from './cron.js'

// we need to mock modules _before_ importing the thing under test so that
// the real scheduler doesn't run.  Vitest handles hoisting of mocks like
// jest, but being explicit is clearer.
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn()
  }
}))

vi.mock('#~/common/helpers/payment-processor.js', () => ({
  processDailyPayments: vi.fn()
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
    expect(cronJob.schedule).toHaveBeenCalledWith(
      '10 2 * * *',
      expect.any(Function)
    )
  })

  it('calls processDailyPayments when the scheduled callback runs', () => {
    cron.plugin.register(mockServer)

    // capture the callback that was passed to schedule and execute it
    const scheduledFn = cronJob.schedule.mock.calls[0][1]
    scheduledFn()

    expect(processDailyPayments).toHaveBeenCalledWith(mockServer)
  })
})
