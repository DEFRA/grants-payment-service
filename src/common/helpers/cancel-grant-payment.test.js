import { describe, expect, it, vi, beforeEach } from 'vitest'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { cancelGrantPayments } from './cancel-grant-payment.js'

vi.mock('#~/api/common/models/grant_payments.js', () => {
  return {
    default: {
      find: vi.fn()
    }
  }
})

describe('cancelGrantPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-23'))
  })

  it('should cancel pending payments with dueDate >= today', async () => {
    const sbi = '106284736'
    const frn = '12544567'
    const today = '2026-03-23'
    const futureDate = '2026-06-05'
    const pastDate = '2026-03-22'

    const mockSave = vi.fn()
    const mockGrantPayment = {
      sbi,
      frn,
      grants: [
        {
          payments: [
            { dueDate: futureDate, status: 'pending' },
            { dueDate: today, status: 'pending' },
            { dueDate: pastDate, status: 'pending' },
            { dueDate: futureDate, status: 'paid' }
          ]
        }
      ],
      save: mockSave
    }

    GrantPaymentsModel.find.mockResolvedValue([mockGrantPayment])

    const result = await cancelGrantPayments(sbi, frn)

    expect(GrantPaymentsModel.find).toHaveBeenCalledWith({ sbi, frn })
    expect(mockGrantPayment.grants[0].payments[0].status).toBe('cancelled')
    expect(mockGrantPayment.grants[0].payments[1].status).toBe('cancelled')
    expect(mockGrantPayment.grants[0].payments[2].status).toBe('pending') // past date not cancelled
    expect(mockGrantPayment.grants[0].payments[3].status).toBe('paid') // non-pending not cancelled
    expect(mockSave).toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(mockGrantPayment)
  })

  it('should not call save if no payments were updated', async () => {
    const sbi = '106284736'
    const frn = '12544567'
    const pastDate = '2026-03-22'

    const mockSave = vi.fn()
    const mockGrantPayment = {
      sbi,
      frn,
      grants: [
        {
          payments: [{ dueDate: pastDate, status: 'pending' }]
        }
      ],
      save: mockSave
    }

    GrantPaymentsModel.find.mockResolvedValue([mockGrantPayment])

    const result = await cancelGrantPayments(sbi, frn)

    expect(mockSave).not.toHaveBeenCalled()
    expect(result).toHaveLength(0)
  })
})
