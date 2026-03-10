import { describe, it, expect, vi } from 'vitest'
import { createGrantPayment } from './create-grant-payment.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')

describe('createGrantPayment', () => {
  it('creates a grant payment with the provided payload', async () => {
    const payload = {
      sbi: '123456789',
      frn: '987654321',
      claimId: 'R00000001',
      grants: []
    }
    const createdDoc = { _id: 'abc123', ...payload }
    GrantPaymentsModel.create.mockResolvedValue(createdDoc)

    const result = await createGrantPayment(payload)

    expect(GrantPaymentsModel.create).toHaveBeenCalledWith(payload)
    expect(result).toBe(createdDoc)
  })
})
