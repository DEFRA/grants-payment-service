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

  it('returns an existing grant payment when the same grant correlation id is received again', async () => {
    const payload = {
      sbi: '123456789',
      frn: '987654321',
      claimId: 'R00000001',
      grants: [
        {
          correlationId: 'grant-123',
          payments: [{ correlationId: 'payment-123' }]
        }
      ]
    }
    const existingDoc = { _id: 'existing-doc', ...payload }
    GrantPaymentsModel.findOne.mockResolvedValue(existingDoc)

    const result = await createGrantPayment(payload)

    expect(GrantPaymentsModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        'grants.correlationId': { $in: ['grant-123'] }
      })
    )
    expect(GrantPaymentsModel.create).not.toHaveBeenCalled()
    expect(result).toBe(existingDoc)
  })
})

describe('createGrantPayment setting correlationId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    GrantPaymentsModel.findOne.mockResolvedValue(null)
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
        }
      ]
    }
    GrantPaymentsModel.create.mockResolvedValue({})

    await createGrantPayment(payload)

    const callArgs = GrantPaymentsModel.create.mock.calls[0][0]
    expect(callArgs.grants[0].payments).toEqual([])
  })
})
