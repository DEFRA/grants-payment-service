import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('#~/api/common/models/grant_payments.js', () => ({
  default: {
    create: vi.fn(),
    findOne: vi.fn()
  }
}))

import { createGrantPayment } from './create-grant-payment.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

describe('createGrantPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    GrantPaymentsModel.findOne.mockResolvedValue(null)
  })

  it('creates a grant payment with the provided payload', async () => {
    const payload = {
      sbi: '123456789',
      frn: '987654321',
      claimId: 'R00000001',
      grants: []
    }
    const createdDoc = { _id: 'abc123', ...payload }
    GrantPaymentsModel.findOne.mockResolvedValue(null)
    GrantPaymentsModel.create.mockResolvedValue(createdDoc)

    const result = await createGrantPayment(payload)

    expect(GrantPaymentsModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sbi: '123456789',
        frn: '987654321',
        claimId: 'R00000001'
      })
    )
    expect(result).toBe(createdDoc)
  })
})
