import { describe, it, expect, vi } from 'vitest'
import {
  updatePaymentStatus,
  markAllStaleLockedPaymentsAsFailed
} from './update-payment-status.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { getLogger } from '#~/common/helpers/logging/logger.js'
import { config } from '#~/config/index.js'

vi.mock('#~/api/common/models/grant_payments.js')
vi.mock('#~/common/helpers/logging/logger.js')
vi.mock('#~/config/index.js')

describe('updatePaymentStatus', () => {
  const logger = {
    info: vi.fn(),
    error: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getLogger.mockReturnValue(logger)
  })

  it('sets the status on the correct nested payment', async () => {
    const docId = 'doc123'
    const paymentId = 'pay456'
    GrantPaymentsModel.findOneAndUpdate.mockResolvedValue({ _id: docId })

    const result = await updatePaymentStatus(docId, paymentId, 'locked')

    expect(GrantPaymentsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: docId },
      { $set: { 'grants.$[].payments.$[p].status': 'locked' } },
      { arrayFilters: [{ 'p._id': paymentId }], returnDocument: 'after' }
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Updated payment ${paymentId} (doc ${docId}) status to locked`
    )
    expect(result).toEqual({ _id: docId })
  })

  it('only updates when the current status matches when provided', async () => {
    const docId = 'docX'
    const paymentId = 'payY'
    GrantPaymentsModel.findOneAndUpdate.mockResolvedValue(null)

    const result = await updatePaymentStatus(
      docId,
      paymentId,
      'locked',
      'pending'
    )

    expect(GrantPaymentsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: docId },
      { $set: { 'grants.$[].payments.$[p].status': 'locked' } },
      {
        arrayFilters: [{ 'p._id': paymentId, 'p.status': 'pending' }],
        returnDocument: 'after'
      }
    )
    expect(result).toEqual(null)
  })

  it('logs and rethrows if the update fails', async () => {
    const error = new Error('fail')
    GrantPaymentsModel.findOneAndUpdate.mockRejectedValue(error)

    await expect(updatePaymentStatus('a', 'b', 'submitted')).rejects.toThrow(
      error
    )

    expect(logger.error).toHaveBeenCalledWith(
      error,
      `Failed to update status to submitted for payment b in a`
    )
  })
})

describe('markAllStaleLockedPaymentsAsFailed', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getLogger.mockReturnValue(logger)
    config.get.mockReturnValue(300000) // 5 minutes TTL
  })

  it('processes stale locked payments', async () => {
    const mockSession = {
      withTransaction: vi.fn(),
      endSession: vi.fn()
    }
    const staleDate = new Date('2026-01-01T00:00:00Z')
    const staleDocuments = [
      {
        sbi: '106284736',
        frn: '12544567',
        claimId: 'R00000004',
        grants: [
          {
            invoiceNumber: 'INV-001',
            agreementNumber: 'AGR-001',
            payments: [
              {
                correlationId: 'corr-1',
                status: 'locked',
                updatedAt: staleDate,
                dueDate: '2026-06-05',
                totalAmountPence: '1263'
              },
              {
                correlationId: 'corr-2',
                status: 'submitted',
                updatedAt: staleDate,
                dueDate: '2026-06-05',
                totalAmountPence: '1263'
              }
            ]
          }
        ]
      }
    ]

    GrantPaymentsModel.startSession.mockResolvedValue(mockSession)
    GrantPaymentsModel.find.mockResolvedValue(staleDocuments)
    GrantPaymentsModel.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 2
    })

    mockSession.withTransaction.mockImplementation(async (fn, options) => {
      await fn()
    })

    const result = await markAllStaleLockedPaymentsAsFailed()

    expect(result.modifiedCount).toBe(2)
    expect(result.affectedPayments).toEqual([
      {
        sbi: '106284736',
        frn: '12544567',
        claimId: 'R00000004',
        correlationId: 'corr-1',
        invoiceNumber: 'INV-001',
        agreementNumber: 'AGR-001',
        dueDate: '2026-06-05',
        totalAmountPence: '1263'
      }
    ])
    expect(mockSession.withTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      { readPreference: 'primary' }
    )
    expect(GrantPaymentsModel.updateMany).toHaveBeenCalledWith(
      {
        grants: {
          $elemMatch: {
            payments: {
              $elemMatch: {
                status: 'locked',
                updatedAt: { $lt: expect.any(Date) }
              }
            }
          }
        }
      },
      expect.any(Object),
      {
        session: mockSession,
        arrayFilters: [
          {
            'p.status': 'locked',
            'p.updatedAt': { $lt: expect.any(Date) }
          }
        ]
      }
    )
    expect(mockSession.endSession).toHaveBeenCalled()
  })

  it('returns 0 when no stale payments found', async () => {
    const mockSession = {
      withTransaction: vi.fn(),
      endSession: vi.fn()
    }

    GrantPaymentsModel.startSession.mockResolvedValue(mockSession)
    GrantPaymentsModel.find.mockResolvedValue([])
    GrantPaymentsModel.updateMany.mockResolvedValue({
      acknowledged: true,
      modifiedCount: 0
    })

    mockSession.withTransaction.mockImplementation(async (fn, options) => {
      await fn()
    })

    const result = await markAllStaleLockedPaymentsAsFailed()

    expect(result.modifiedCount).toBe(0)
    expect(result.affectedPayments).toEqual([])
    expect(mockSession.withTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      { readPreference: 'primary' }
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('handles transaction errors properly', async () => {
    const mockSession = {
      withTransaction: vi.fn(),
      endSession: vi.fn()
    }

    const error = new Error('transaction failed')
    GrantPaymentsModel.startSession.mockResolvedValue(mockSession)

    mockSession.withTransaction.mockRejectedValue(error)

    await expect(markAllStaleLockedPaymentsAsFailed()).rejects.toThrow(error)

    expect(logger.error).toHaveBeenCalledWith(
      error,
      expect.stringContaining('Error in stale locked payment cleanup')
    )
    expect(mockSession.endSession).toHaveBeenCalled()
  })
})
