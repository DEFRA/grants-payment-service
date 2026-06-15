import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteGrantPaymentsBySbi } from './delete-grant-payments-by-sbi.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')

describe('deleteGrantPaymentsBySbi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes payments by SBI only', async () => {
    const sbi = '123456789'
    const mockResult = { deletedCount: 5 }
    GrantPaymentsModel.deleteMany.mockResolvedValue(mockResult)

    const result = await deleteGrantPaymentsBySbi(sbi)

    expect(GrantPaymentsModel.deleteMany).toHaveBeenCalledWith({ sbi })
    expect(result).toEqual({ deletedCount: 5 })
  })

  it('deletes payments by SBI and fundCode', async () => {
    const sbi = '123456789'
    const fundCode = 'AGF1'
    const mockResult = { deletedCount: 3 }
    GrantPaymentsModel.deleteMany.mockResolvedValue(mockResult)

    const result = await deleteGrantPaymentsBySbi(sbi, fundCode)

    expect(GrantPaymentsModel.deleteMany).toHaveBeenCalledWith({
      sbi,
      'grants.payments.invoiceLines.fundCode': fundCode
    })
    expect(result).toEqual({ deletedCount: 3 })
  })

  it('returns deletedCount of 0 when no payments found', async () => {
    const sbi = '123456789'
    const mockResult = { deletedCount: 0 }
    GrantPaymentsModel.deleteMany.mockResolvedValue(mockResult)

    const result = await deleteGrantPaymentsBySbi(sbi)

    expect(GrantPaymentsModel.deleteMany).toHaveBeenCalledWith({ sbi })
    expect(result).toEqual({ deletedCount: 0 })
  })

  it('handles deletion with fundCode when no payments match', async () => {
    const sbi = '123456789'
    const fundCode = 'AGF1'
    const mockResult = { deletedCount: 0 }
    GrantPaymentsModel.deleteMany.mockResolvedValue(mockResult)

    const result = await deleteGrantPaymentsBySbi(sbi, fundCode)

    expect(GrantPaymentsModel.deleteMany).toHaveBeenCalledWith({
      sbi,
      'grants.payments.invoiceLines.fundCode': fundCode
    })
    expect(result).toEqual({ deletedCount: 0 })
  })
})
