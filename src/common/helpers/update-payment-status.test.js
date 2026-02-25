import { describe, it, expect, vi } from 'vitest'
import { updatePaymentStatus } from './update-payment-status.js'
import GrantPaymentsModel from '#~/api/common/grant_payments.js'
import { getLogger } from '#~/common/helpers/logging/logger.js'

vi.mock('#~/api/common/grant_payments.js')
vi.mock('#~/common/helpers/logging/logger.js')

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
    GrantPaymentsModel.updateOne.mockResolvedValue({ n: 1 })

    const result = await updatePaymentStatus(docId, paymentId, 'locked')

    expect(GrantPaymentsModel.updateOne).toHaveBeenCalledWith(
      { _id: docId },
      { $set: { 'grants.$[].payments.$[p].status': 'locked' } },
      { arrayFilters: [{ 'p._id': paymentId }] }
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Updated payment ${paymentId} (doc ${docId}) status to locked`
    )
    expect(result).toEqual({ n: 1 })
  })

  it('only updates when the current status matches when provided', async () => {
    const docId = 'docX'
    const paymentId = 'payY'
    GrantPaymentsModel.updateOne.mockResolvedValue({ n: 0 })

    const result = await updatePaymentStatus(
      docId,
      paymentId,
      'locked',
      'pending'
    )

    expect(GrantPaymentsModel.updateOne).toHaveBeenCalledWith(
      { _id: docId },
      { $set: { 'grants.$[].payments.$[p].status': 'locked' } },
      { arrayFilters: [{ 'p._id': paymentId, 'p.status': 'pending' }] }
    )
    expect(result).toEqual({ n: 0 })
  })

  it('logs and rethrows if the update fails', async () => {
    const error = new Error('fail')
    GrantPaymentsModel.updateOne.mockRejectedValue(error)

    await expect(updatePaymentStatus('a', 'b', 'submitted')).rejects.toThrow(
      error
    )

    expect(logger.error).toHaveBeenCalledWith(
      error,
      `Failed to update status to submitted for payment b in a`
    )
  })
})
