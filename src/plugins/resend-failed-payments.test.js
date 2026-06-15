import { vi, describe, it, expect, beforeEach } from 'vitest'

const updateManyMock = vi.fn()
const onceMock = vi.fn()
const getMock = vi.fn()
const processDailyPaymentsMock = vi.fn()

vi.mock('#~/api/common/models/grant_payments.js', () => ({
  default: {
    updateMany: updateManyMock
  }
}))

const mongooseMock = {
  default: { connection: { readyState: 1, once: onceMock } }
}
vi.mock('mongoose', () => mongooseMock)

vi.mock('#~/config/index.js', () => ({
  config: {
    get: getMock
  }
}))

vi.mock('#~/common/helpers/payment-processor.js', () => ({
  processDailyPayments: processDailyPaymentsMock
}))

describe('resend-failed-payments plugin', () => {
  let plugin

  beforeEach(async () => {
    vi.clearAllMocks()
    mongooseMock.default.connection.readyState = 1
    onceMock.mockReset()
    updateManyMock.mockReset()
    processDailyPaymentsMock.mockReset()
    getMock.mockReset()
    getMock.mockImplementation((key) => {
      if (key === 'featureFlags.resendFailedPaymentsEnabled') {
        return true
      }
      return undefined
    })
    const mod = await import('./resend-failed-payments.js')
    plugin = mod.resendFailedPayments
  })

  it('updates failed payments to pending and triggers processDailyPayments when failed payments exist', async () => {
    updateManyMock.mockResolvedValue({ modifiedCount: 5 })
    processDailyPaymentsMock.mockResolvedValue({
      results: [],
      fetchDuration: 100,
      processDuration: 200,
      sendDuration: 300
    })

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(updateManyMock).toHaveBeenCalledWith(
      {
        grants: {
          $elemMatch: {
            payments: {
              $elemMatch: {
                status: 'failed'
              }
            }
          }
        }
      },
      {
        $set: {
          'grants.$[].payments.$[p].status': 'pending',
          'grants.$[].payments.$[p].updatedAt': expect.any(Date)
        }
      },
      {
        arrayFilters: [
          {
            'p.status': 'failed'
          }
        ]
      }
    )
    expect(processDailyPaymentsMock).toHaveBeenCalledWith(fakeServer)
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'resend-failed-payments: updated 5 failed payment(s) to pending'
    )
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'resend-failed-payments: triggering processDailyPayments to process updated payments'
    )
  })

  it('does not trigger processDailyPayments when no failed payments exist', async () => {
    updateManyMock.mockResolvedValue({ modifiedCount: 0 })

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(updateManyMock).toHaveBeenCalled()
    expect(processDailyPaymentsMock).not.toHaveBeenCalled()
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'Registering resend-failed-payments plugin'
    )
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'resend-failed-payments: updated 0 failed payment(s) to pending'
    )
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'resend-failed-payments: no failed payments found to resend'
    )
  })

  it('waits for mongoose connection when not ready', async () => {
    mongooseMock.default.connection.readyState = 0
    onceMock.mockImplementation((event, handler) => {
      if (event === 'connected') {
        handler()
      }
    })
    updateManyMock.mockResolvedValue({ modifiedCount: 0 })

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(onceMock).toHaveBeenCalledWith('connected', expect.any(Function))
    expect(updateManyMock).toHaveBeenCalled()
  })

  it('logs errors when resend failed payments fails', async () => {
    const error = new Error('update failed')
    updateManyMock.mockRejectedValue(error)

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(fakeServer.logger.error).toHaveBeenCalledWith(
      error,
      'resend-failed-payments: resend failed payments failed'
    )
  })

  it('does not register hooks or run resend failed payments if the feature flag is disabled', async () => {
    getMock.mockImplementation((key) => {
      if (key === 'featureFlags.resendFailedPaymentsEnabled') {
        return false
      }
      return undefined
    })

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(onceMock).not.toHaveBeenCalled()
    expect(updateManyMock).not.toHaveBeenCalled()
    expect(processDailyPaymentsMock).not.toHaveBeenCalled()
    expect(fakeServer.logger.info).not.toHaveBeenCalledWith(
      'Registering resend-failed-payments plugin'
    )
    expect(fakeServer.logger.info).not.toHaveBeenCalledWith(
      'resend-failed-payments: updated 0 failed payment(s) to pending'
    )
  })

  it('handles errors from processDailyPayments gracefully', async () => {
    updateManyMock.mockResolvedValue({ modifiedCount: 1 })
    processDailyPaymentsMock.mockRejectedValue(
      new Error('processDailyPayments failed')
    )

    const fakeServer = { logger: { info: vi.fn(), error: vi.fn() } }
    await plugin.plugin.register(fakeServer)

    expect(updateManyMock).toHaveBeenCalled()
    expect(processDailyPaymentsMock).toHaveBeenCalledWith(fakeServer)
    expect(fakeServer.logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      'resend-failed-payments: resend failed payments failed'
    )
  })
})
