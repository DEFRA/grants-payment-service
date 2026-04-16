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

  describe('setting correlationId', () => {
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

    it('does not overwrite existing correlationId in grants and payments', async () => {
      const payload = {
        sbi: '123456789',
        frn: '987654321',
        claimId: 'R00000001',
        grants: [
          {
            correlationId: 'existing-grant-id',
            payments: [{ correlationId: 'existing-payment-id' }]
          }
        ]
      }
      GrantPaymentsModel.create.mockResolvedValue({})

      await createGrantPayment(payload)

      const callArgs = GrantPaymentsModel.create.mock.calls[0][0]
      expect(callArgs.grants[0].correlationId).toBe('existing-grant-id')
      expect(callArgs.grants[0].payments[0].correlationId).toBe(
        'existing-payment-id'
      )
    })

    it('handles missing grants array gracefully', async () => {
      const payload = {
        sbi: '123456789',
        frn: '987654321',
        claimId: 'R00000001'
        // missing grants
      }
      GrantPaymentsModel.create.mockResolvedValue({})

      await createGrantPayment(payload)

      const callArgs = GrantPaymentsModel.create.mock.calls[0][0]
      expect(callArgs.grants).toEqual([])
    })

    it('handles missing payments array gracefully', async () => {
      const payload = {
        sbi: '123456789',
        frn: '987654321',
        claimId: 'R00000001',
        grants: [
          {
            sourceSystem: 'FPTT'
            // missing payments
          }
        ]
      }
      GrantPaymentsModel.create.mockResolvedValue({})

      await createGrantPayment(payload)

      const callArgs = GrantPaymentsModel.create.mock.calls[0][0]
      expect(callArgs.grants[0].payments).toEqual([])
    })
  })
})
