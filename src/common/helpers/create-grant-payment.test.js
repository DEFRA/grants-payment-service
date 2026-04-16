import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGrantPayment } from './create-grant-payment.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')

describe('createGrantPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('adds correlationId to grants and payments if missing', async () => {
    const payload = {
      sbi: '123456789',
      frn: '987654321',
      claimId: 'R00000001',
      grants: [
        {
          sourceSystem: 'FPTT',
          payments: [{ dueDate: '2026-01-01' }]
        }
      ]
    }
    GrantPaymentsModel.create.mockResolvedValue({})

    await createGrantPayment(payload)

    const callArgs = GrantPaymentsModel.create.mock.calls[0][0]
    expect(callArgs.grants[0].correlationId).toBeDefined()
    expect(callArgs.grants[0].payments[0].correlationId).toBeDefined()
    expect(callArgs.grants[0].correlationId).toEqual(expect.any(String))
    expect(callArgs.grants[0].payments[0].correlationId).toEqual(
      expect.any(String)
    )
  })
})
