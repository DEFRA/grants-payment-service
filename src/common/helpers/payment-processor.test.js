import { describe, it, expect, vi } from 'vitest'
import { processDailyPayments } from './payment-processor.js'
import { fetchGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'
import { updatePaymentStatus } from '#~/common/helpers/update-payment-status.js'
import { getTodaysDate } from './date.js'

vi.mock('#~/common/helpers/fetch-grants-by-date.js', () => ({
  fetchGrantPaymentsByDate: vi.fn()
}))
vi.mock('#~/common/helpers/payment-hub/index.js', () => ({
  sendPaymentHubRequest: vi.fn()
}))
vi.mock('#~/common/helpers/update-payment-status.js', () => ({
  updatePaymentStatus: vi.fn()
}))

describe('processDailyPayments', () => {
  const logger = {
    info: vi.fn(),
    error: vi.fn()
  }
  const server = { logger }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('uses provided date, locks each payment and proxies to PaymentHub, returning results', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [
      {
        _id: '1',
        grants: [
          {
            payments: [
              {
                _id: 'p1',
                amount: 10,
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                recoveryDate: '2026-01-01',
                originalSettlementDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      },
      {
        _id: '2',
        grants: [
          {
            payments: [
              {
                _id: 'p2',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                recoveryDate: '2026-01-01',
                originalSettlementDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      }
    ]
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)
    const responses = ['a', 'b']
    sendPaymentHubRequest
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])

    // locks should succeed so we return n:1 each time
    updatePaymentStatus.mockResolvedValue({ n: 1 })

    const result = await processDailyPayments(server, fakeDate)

    expect(fetchGrantPaymentsByDate).toHaveBeenCalledWith(fakeDate, 'pending')
    expect(logger.info).toHaveBeenCalledWith(
      `Processing daily payments for date: ${fakeDate}`
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Found ${fakeDocs.length} payment record(s) matching due date ${fakeDate}`
    )

    // each payment should be locked (pending->locked) then submitted
    expect(updatePaymentStatus).toHaveBeenCalledWith(
      '1',
      'p1',
      'locked',
      'pending'
    )
    expect(updatePaymentStatus).toHaveBeenCalledWith('1', 'p1', 'submitted')
    expect(updatePaymentStatus).toHaveBeenCalledWith(
      '2',
      'p2',
      'locked',
      'pending'
    )
    expect(updatePaymentStatus).toHaveBeenCalledWith('2', 'p2', 'submitted')

    expect(sendPaymentHubRequest).toHaveBeenCalledTimes(2)
    expect(sendPaymentHubRequest).toHaveBeenNthCalledWith(
      1,
      server,
      expect.any(Object)
    )
    expect(sendPaymentHubRequest).toHaveBeenNthCalledWith(
      2,
      server,
      expect.any(Object)
    )
    expect(result).toEqual(responses)
  })

  it('skips payments that cannot be locked by another instance', async () => {
    const fakeDate = '2026-02-20'
    // two payments, but the second fails to lock
    const fakeDocs = [
      {
        _id: '1',
        grants: [
          {
            payments: [
              {
                _id: 'x',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                recoveryDate: '2026-01-01',
                originalSettlementDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      },
      {
        _id: '2',
        grants: [
          {
            payments: [
              {
                _id: 'y',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                recoveryDate: '2026-01-01',
                originalSettlementDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      }
    ]
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)

    // first lock succeeds, second returns {n:0} meaning already handled
    updatePaymentStatus
      .mockResolvedValueOnce({ n: 1 })
      .mockResolvedValueOnce({ n: 0 })

    sendPaymentHubRequest.mockResolvedValue('ok')

    const result = await processDailyPayments(server, fakeDate)

    // only one hub request should be made
    expect(sendPaymentHubRequest).toHaveBeenCalledTimes(1)
    expect(result).toEqual(['ok', null])
    expect(logger.info).toHaveBeenCalledWith(
      `Skipping payment y (already locked or processed)`
    )
  })

  it('defaults to today if no date supplied', async () => {
    const today = getTodaysDate()
    const fakeDocs = []
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)

    const result = await processDailyPayments(server)

    expect(fetchGrantPaymentsByDate).toHaveBeenCalledWith(today, 'pending')
    expect(result).toEqual([])
  })

  it('handles documents with no grants and grants with no payments gracefully', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [
      // document with no grants (undefined)
      { _id: 'no-grants' },
      // document with a grant that has no payments (undefined)
      { _id: 'no-payments', grants: [{ invoiceNumber: 'INV1' }] }
    ]
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)

    const result = await processDailyPayments(server, fakeDate)

    // no payments to process, hub is never called, result is empty
    expect(sendPaymentHubRequest).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('logs and rethrows when the database query fails', async () => {
    const fakeDate = '2026-02-20'
    const error = new Error('db failure')
    fetchGrantPaymentsByDate.mockRejectedValue(error)

    await expect(processDailyPayments(server, fakeDate)).rejects.toThrow(error)

    expect(logger.error).toHaveBeenCalledWith(
      error,
      `Failed to query grant payments for date ${fakeDate}`
    )
  })

  it('skips and marks as failed payments with an unsupported sourceSystem', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [
      {
        _id: '1',
        grants: [
          {
            payments: [
              {
                _id: 'p1',
                sourceSystem: 'UNKNOWN',
                dueDate: '2026-01-01',
                recoveryDate: '2026-01-01',
                originalSettlementDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      }
    ]
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)
    updatePaymentStatus.mockResolvedValue({ n: 1 })

    const result = await processDailyPayments(server, fakeDate)

    // hub should never be called for an unsupported sourceSystem
    expect(sendPaymentHubRequest).not.toHaveBeenCalled()
    // payment should be marked as failed
    expect(updatePaymentStatus).toHaveBeenCalledWith('1', 'p1', 'failed')
    // an error should be logged
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported grant sourceSystem UNKNOWN')
    )
    expect(result).toEqual([null])
  })

  it('logs individual hub failures and continues, updating status appropriately', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [
      {
        _id: '1',
        grants: [
          {
            payments: [
              {
                _id: 'a',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                recoveryDate: '2026-01-01',
                originalSettlementDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      },
      {
        _id: '2',
        grants: [
          {
            payments: [
              {
                _id: 'b',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                recoveryDate: '2026-01-01',
                originalSettlementDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      },
      {
        _id: '3',
        grants: [
          {
            payments: [
              {
                _id: 'c',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                recoveryDate: '2026-01-01',
                originalSettlementDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      }
    ]
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)

    // first and third succeed, second fails
    sendPaymentHubRequest
      .mockResolvedValueOnce('ok1')
      .mockRejectedValueOnce(new Error('hub down'))
      .mockResolvedValueOnce('ok3')

    // allow locking for each payment
    updatePaymentStatus.mockResolvedValue({ n: 1 })

    const result = await processDailyPayments(server, fakeDate)

    expect(result).toEqual(['ok1', null, 'ok3'])
    // lock called for each payment
    expect(updatePaymentStatus).toHaveBeenCalledWith(
      '1',
      'a',
      'locked',
      'pending'
    )
    expect(updatePaymentStatus).toHaveBeenCalledWith(
      '2',
      'b',
      'locked',
      'pending'
    )
    expect(updatePaymentStatus).toHaveBeenCalledWith(
      '3',
      'c',
      'locked',
      'pending'
    )
    // second payment should be marked failed when hub errors
    expect(updatePaymentStatus).toHaveBeenCalledWith('2', 'b', 'failed')

    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      `PaymentHub request failed for record ${fakeDocs[1]._id}`
    )
  })
})
