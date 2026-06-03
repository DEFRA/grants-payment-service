import { describe, it, expect, vi } from 'vitest'
import {
  processDailyPayments,
  processStaleLockedPayments
} from './payment-processor.js'
import {
  streamGrantPaymentsByDate,
  streamGrantPaymentsByPaymentIds
} from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'
import {
  updatePaymentStatus,
  markAllStaleLockedPaymentsAsFailed
} from '#~/common/helpers/update-payment-status.js'
import { getTodaysDate, getNextDay } from './date.js'

vi.mock('#~/common/helpers/fetch-grants-by-date.js', () => ({
  fetchGrantPaymentsByDate: vi.fn(),
  streamGrantPaymentsByDate: vi.fn(),
  streamGrantPaymentsByPaymentIds: vi.fn()
}))
vi.mock('#~/common/helpers/payment-hub/index.js', () => ({
  sendPaymentHubRequest: vi.fn()
}))
vi.mock('#~/common/helpers/update-payment-status.js', () => ({
  updatePaymentStatus: vi.fn(),
  markAllStaleLockedPaymentsAsFailed: vi.fn()
}))
vi.mock('#~/api/common/models/grant_payments.js', () => ({
  default: {
    findOne: vi.fn(),
    updateMany: vi.fn()
  }
}))

describe('processDailyPayments', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
  const server = { logger }

  const mockCursor = (docs) => ({
    eachAsync: vi.fn().mockImplementation(async (callback) => {
      for (const doc of docs) {
        await callback(doc)
      }
    })
  })

  beforeEach(() => {
    vi.resetAllMocks()
    markAllStaleLockedPaymentsAsFailed.mockResolvedValue(0)
  })

  it('uses provided date, locks each payment and proxies to PaymentHub, returning results via stream', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [
      {
        _id: '1',
        grants: [
          {
            _id: 'g1',
            sourceSystem: 'FPTT',
            invoiceNumber: 'INV1',
            agreementNumber: 'AGR1',
            payments: [
              {
                _id: 'p1',
                amountPence: 1000,
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                recoveryDate: '2026-01-01',
                originalSettlementDate: '2026-01-01',
                invoiceLines: []
              }
            ],
            matchedPayments: [
              {
                _id: 'p1',
                amountPence: 1000,
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
            _id: 'g2',
            sourceSystem: 'FPTT',
            invoiceNumber: 'INV1',
            agreementNumber: 'AGR1',
            payments: [
              {
                _id: 'p2',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                recoveryDate: '2026-01-01',
                originalSettlementDate: '2026-01-01',
                invoiceLines: []
              }
            ],
            matchedPayments: [
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

    streamGrantPaymentsByDate.mockReturnValue(mockCursor(fakeDocs))
    const responses = ['a', 'b']
    sendPaymentHubRequest
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])

    updatePaymentStatus.mockResolvedValue({ _id: 'mock-doc' })

    const result = await processDailyPayments(server, undefined, {
      date: fakeDate
    })

    expect(streamGrantPaymentsByDate).toHaveBeenCalledWith(
      fakeDate,
      'pending',
      undefined
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Processing payments for dates: ${fakeDate} - ${getNextDay(fakeDate)}`
    )

    expect(sendPaymentHubRequest).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      results: [
        { paymentId: 'p1', docId: '1' },
        { paymentId: 'p2', docId: '2' }
      ],
      backgroundTasks: expect.any(Array),
      fetchDuration: expect.any(String),
      processDuration: expect.any(String),
      sendDuration: expect.any(String)
    })

    // Wait for background tasks to complete
    await vi.waitFor(() => {
      expect(updatePaymentStatus).toHaveBeenCalledWith('1', 'p1', 'submitted')
      expect(updatePaymentStatus).toHaveBeenCalledWith('2', 'p2', 'submitted')
    })
  })

  it('skips payments that cannot be locked by another instance', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [
      {
        _id: '1',
        grants: [
          {
            _id: 'g1',
            sourceSystem: 'FPTT',
            invoiceNumber: 'INV1',
            agreementNumber: 'AGR1',
            payments: [
              {
                _id: 'x',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                invoiceLines: []
              }
            ],
            matchedPayments: [
              {
                _id: 'x',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
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
            _id: 'g2',
            sourceSystem: 'FPTT',
            invoiceNumber: 'INV1',
            agreementNumber: 'AGR1',
            payments: [
              {
                _id: 'y',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                invoiceLines: []
              }
            ],
            matchedPayments: [
              {
                _id: 'y',
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      }
    ]
    streamGrantPaymentsByDate.mockReturnValue(mockCursor(fakeDocs))

    updatePaymentStatus
      .mockResolvedValueOnce({ _id: 'doc1' })
      .mockResolvedValueOnce(null)

    sendPaymentHubRequest.mockResolvedValue('ok')

    const result = await processDailyPayments(server, undefined, {
      date: fakeDate
    })

    expect(sendPaymentHubRequest).toHaveBeenCalledTimes(1)
    expect(result.results).toEqual([{ paymentId: 'x', docId: '1' }, null])
    expect(logger.info).toHaveBeenCalledWith(
      `Skipping payment y (already locked or processed)`
    )
  })

  it('defaults to today if no date supplied', async () => {
    const today = getTodaysDate()
    streamGrantPaymentsByDate.mockReturnValue(mockCursor([]))

    const result = await processDailyPayments(server, undefined, {})

    expect(streamGrantPaymentsByDate).toHaveBeenCalledWith(
      today,
      'pending',
      undefined
    )
    expect(result).toEqual({
      results: [],
      backgroundTasks: [],
      fetchDuration: expect.any(String),
      processDuration: expect.any(String),
      sendDuration: expect.any(String)
    })
  })

  it('handles documents with no grants and grants with no payments gracefully', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [
      { _id: 'no-grants' },
      {
        _id: 'no-payments',
        grants: [{ invoiceNumber: 'INV1', agreementNumber: 'AGR1' }]
      }
    ]
    streamGrantPaymentsByDate.mockReturnValue(mockCursor(fakeDocs))

    const result = await processDailyPayments(server, undefined, {
      date: fakeDate
    })

    expect(sendPaymentHubRequest).not.toHaveBeenCalled()
    expect(result.results).toEqual([])
  })

  it('logs and rethrows when the streaming fails', async () => {
    const fakeDate = '2026-02-20'
    const error = new Error('streaming failure')
    streamGrantPaymentsByDate.mockReturnValue({
      eachAsync: vi.fn().mockRejectedValue(error)
    })

    await expect(
      processDailyPayments(server, undefined, { date: fakeDate })
    ).rejects.toThrow(error)

    expect(logger.error).toHaveBeenCalledWith(
      error,
      `Failed to process payments for dates: ${fakeDate} - ${getNextDay(fakeDate)}`
    )
  })

  it('marks payment as failed when transform throws after lock', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [
      {
        _id: '1',
        grants: [
          {
            _id: 'g1',
            sourceSystem: 'FPTT',
            invoiceNumber: 'INV1',
            agreementNumber: 'AGR1',
            ledger: 'AP',
            fesCode: 'FALS_FPTT',
            deliveryBody: 'RP00',
            payments: [
              {
                _id: 'p1',
                dueDate: '2026-01-01',
                correlationId: 'corr-1',
                invoiceLines: []
              }
            ],
            matchedPayments: [
              {
                _id: 'p-other',
                dueDate: '2026-01-01',
                correlationId: 'corr-other',
                invoiceLines: []
              }
            ]
          }
        ]
      }
    ]
    streamGrantPaymentsByDate.mockReturnValue(mockCursor(fakeDocs))
    updatePaymentStatus.mockResolvedValue({ _id: 'mock-doc' })

    const result = await processDailyPayments(server, undefined, {
      date: fakeDate
    })

    expect(sendPaymentHubRequest).not.toHaveBeenCalled()
    expect(updatePaymentStatus).toHaveBeenCalledWith('1', 'p-other', 'failed')
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      'Payment Hub data transform failed for payment p-other in record 1'
    )
    expect(result.results[0]).toMatchObject({
      message: 'Payment not found in the payments array'
    })
  })

  it('skips and marks as failed payments with an unsupported sourceSystem', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [
      {
        _id: '1',
        grants: [
          {
            _id: 'g1',
            sourceSystem: 'UNKNOWN',
            agreementNumber: 'AGR1',
            payments: [
              {
                _id: 'p1',
                sourceSystem: 'UNKNOWN',
                dueDate: '2026-01-01',
                invoiceLines: []
              }
            ],
            matchedPayments: [
              {
                _id: 'p1',
                sourceSystem: 'UNKNOWN',
                dueDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      }
    ]
    streamGrantPaymentsByDate.mockReturnValue(mockCursor(fakeDocs))
    updatePaymentStatus.mockResolvedValue({ _id: 'mock-doc' })

    const result = await processDailyPayments(server, undefined, {
      date: fakeDate
    })

    expect(sendPaymentHubRequest).not.toHaveBeenCalled()
    expect(updatePaymentStatus).toHaveBeenCalledWith('1', 'p1', 'failed')
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unsupported grant sourceSystem UNKNOWN for payment p1'
      }),
      'Payment Hub data transform failed for payment p1 in record 1'
    )
    expect(result.results[0]).toMatchObject({
      message: 'Unsupported grant sourceSystem UNKNOWN for payment p1'
    })
  })

  it('logs individual hub failures and continues, updating status appropriately', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [
      {
        _id: '1',
        grants: [
          {
            _id: 'g1',
            sourceSystem: 'FPTT',
            invoiceNumber: 'INV1',
            agreementNumber: 'AGR1',
            payments: [{ _id: 'a', sourceSystem: 'FPTT', invoiceLines: [] }],
            matchedPayments: [
              { _id: 'a', sourceSystem: 'FPTT', invoiceLines: [] }
            ]
          }
        ]
      },
      {
        _id: '2',
        grants: [
          {
            _id: 'g2',
            sourceSystem: 'FPTT',
            invoiceNumber: 'INV2',
            agreementNumber: 'AGR2',
            payments: [{ _id: 'b', sourceSystem: 'FPTT', invoiceLines: [] }],
            matchedPayments: [
              { _id: 'b', sourceSystem: 'FPTT', invoiceLines: [] }
            ]
          }
        ]
      }
    ]
    streamGrantPaymentsByDate.mockReturnValue(mockCursor(fakeDocs))

    sendPaymentHubRequest
      .mockResolvedValueOnce('ok1')
      .mockRejectedValueOnce(new Error('hub down'))

    updatePaymentStatus.mockResolvedValue({ _id: 'mock-doc' })

    const result = await processDailyPayments(server, undefined, {
      date: fakeDate
    })

    expect(result.results).toEqual([
      { paymentId: 'a', docId: '1' },
      { paymentId: 'b', docId: '2' }
    ])
    await vi.waitFor(() => {
      expect(updatePaymentStatus).toHaveBeenCalledWith('2', 'b', 'failed')
      expect(logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        `PaymentHub request failed for record 2`
      )
    })
  })

  it('passes limit to streamGrantPaymentsByDate and includes it in logs', async () => {
    const fakeDate = '2026-02-20'
    const limit = 5
    streamGrantPaymentsByDate.mockReturnValue(mockCursor([]))

    await processDailyPayments(server, limit, { date: fakeDate })

    expect(streamGrantPaymentsByDate).toHaveBeenCalledWith(
      fakeDate,
      'pending',
      limit
    )

    expect(logger.info).toHaveBeenCalledWith(
      `Processing payments for dates: ${fakeDate} - ${getNextDay(fakeDate)} (limited to ${limit} payments)`
    )
  })

  it('uses provided paymentIds and processes payments by IDs', async () => {
    const fakePaymentIds = ['payment1', 'payment2', 'payment3']
    const fakeDocs = [
      {
        _id: '1',
        grants: [
          {
            _id: 'g1',
            sourceSystem: 'FPTT',
            invoiceNumber: 'INV1',
            agreementNumber: 'AGR1',
            payments: [
              {
                _id: 'payment1',
                amountPence: 1000,
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                invoiceLines: []
              }
            ],
            matchedPayments: [
              {
                _id: 'payment1',
                amountPence: 1000,
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
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
            _id: 'g2',
            sourceSystem: 'FPTT',
            invoiceNumber: 'INV2',
            agreementNumber: 'AGR2',
            payments: [
              {
                _id: 'payment2',
                amountPence: 2000,
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                invoiceLines: []
              }
            ],
            matchedPayments: [
              {
                _id: 'payment2',
                amountPence: 2000,
                sourceSystem: 'FPTT',
                dueDate: '2026-01-01',
                invoiceLines: []
              }
            ]
          }
        ]
      }
    ]

    streamGrantPaymentsByPaymentIds.mockReturnValue(mockCursor(fakeDocs))
    const responses = ['a', 'b']
    sendPaymentHubRequest
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])

    updatePaymentStatus.mockResolvedValue({ _id: 'mock-doc' })

    const result = await processDailyPayments(server, undefined, {
      paymentIds: fakePaymentIds
    })

    expect(streamGrantPaymentsByPaymentIds).toHaveBeenCalledWith(
      fakePaymentIds,
      'pending'
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Processing payments by IDs: ${fakePaymentIds.length} payment(s)`
    )

    expect(sendPaymentHubRequest).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      results: [
        { paymentId: 'payment1', docId: '1' },
        { paymentId: 'payment2', docId: '2' }
      ],
      backgroundTasks: expect.any(Array),
      fetchDuration: expect.any(String),
      processDuration: expect.any(String),
      sendDuration: expect.any(String)
    })

    // Wait for background tasks to complete
    await vi.waitFor(() => {
      expect(updatePaymentStatus).toHaveBeenCalledWith(
        '1',
        'payment1',
        'submitted'
      )
      expect(updatePaymentStatus).toHaveBeenCalledWith(
        '2',
        'payment2',
        'submitted'
      )
    })
  })

  it('throws error when both date and paymentIds are provided', async () => {
    const fakeDate = '2026-02-20'
    const fakePaymentIds = ['payment1', 'payment2']

    await expect(
      processDailyPayments(server, undefined, {
        date: fakeDate,
        paymentIds: fakePaymentIds
      })
    ).rejects.toThrow(
      'Cannot provide both date and paymentIds. Provide one or the other.'
    )
  })
})

describe('processStaleLockedPayments', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
  const server = { logger }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('calls markAllStaleLockedPaymentsAsFailed and logs if any were marked', async () => {
    markAllStaleLockedPaymentsAsFailed.mockResolvedValue(5)

    const result = await processStaleLockedPayments(server)

    expect(markAllStaleLockedPaymentsAsFailed).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('Processing stale locked payments')
    expect(logger.error).toHaveBeenCalledWith(
      'Payment remained locked beyond timeout threshold: marked 5 stale locked payment(s) as failed'
    )
    expect(result).toEqual(5)
  })

  it('does not log error if no stale payments', async () => {
    markAllStaleLockedPaymentsAsFailed.mockResolvedValue(0)

    const result = await processStaleLockedPayments(server)

    expect(markAllStaleLockedPaymentsAsFailed).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('Processing stale locked payments')
    expect(logger.info).toHaveBeenCalledWith('No stale locked payments found')
    expect(logger.error).not.toHaveBeenCalled()
    expect(result).toEqual(0)
  })

  it('logs and rethrows errors', async () => {
    const error = new Error('db error')
    markAllStaleLockedPaymentsAsFailed.mockRejectedValue(error)

    await expect(processStaleLockedPayments(server)).rejects.toThrow(error)
    expect(logger.error).toHaveBeenCalledWith(
      error,
      'Failed to process stale locked payments'
    )
  })
})
