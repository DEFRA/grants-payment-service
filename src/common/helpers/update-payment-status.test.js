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
      setDefaultReadPreference: vi.fn(),
      withTransaction: vi.fn(),
      endSession: vi.fn()
    }

    const staleDoc1 = { _id: 'doc1', grants: [] }
    const staleDoc2 = { _id: 'doc2', grants: [] }

    GrantPaymentsModel.startSession.mockResolvedValue(mockSession)
    GrantPaymentsModel.find.mockResolvedValue([staleDoc1, staleDoc2])
    GrantPaymentsModel.updateOne.mockResolvedValue({ acknowledged: true })

    mockSession.withTransaction.mockImplementation(async (fn) => {
      await fn()
    })

    const result = await markAllStaleLockedPaymentsAsFailed()

    expect(mockSession.setDefaultReadPreference).toHaveBeenCalledWith('primary')
    expect(result).toBe(2)
    expect(GrantPaymentsModel.find).toHaveBeenCalledWith(
      {
        'grants.payments.status': 'locked',
        'grants.payments.updatedAt': { $lt: expect.any(Date) }
      },
      null,
      { session: mockSession }
    )
    expect(GrantPaymentsModel.updateOne).toHaveBeenCalledTimes(2)
    expect(mockSession.endSession).toHaveBeenCalled()
  })

  it('returns 0 when no stale payments found', async () => {
    const mockSession = {
      setDefaultReadPreference: vi.fn(),
      withTransaction: vi.fn(),
      endSession: vi.fn()
    }

    GrantPaymentsModel.startSession.mockResolvedValue(mockSession)
    GrantPaymentsModel.find.mockResolvedValue([])

    mockSession.withTransaction.mockImplementation(async (fn) => {
      await fn()
    })

    const result = await markAllStaleLockedPaymentsAsFailed()

    expect(mockSession.setDefaultReadPreference).toHaveBeenCalledWith('primary')
    expect(result).toBe(0)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('handles transaction errors properly', async () => {
    const mockSession = {
      setDefaultReadPreference: vi.fn(),
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
