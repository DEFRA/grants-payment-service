import { describe, it, expect, vi } from 'vitest'
import { fetchGrantPaymentsBySbi } from './fetch-grant-payments-by-sbi.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')
vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn().mockReturnValue(10)
  }
}))

describe('fetchGrantPaymentsBySbi', () => {
  it('returns payments by the provided sbi', async () => {
    const sbi = '123456789'
    const fakeDocs = [{ _id: 'a', sbi }]
    GrantPaymentsModel.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })
    GrantPaymentsModel.countDocuments.mockResolvedValue(1)

    const result = await fetchGrantPaymentsBySbi(sbi)

    expect(GrantPaymentsModel.find).toHaveBeenCalledWith({ sbi })
    expect(result).toEqual({
      docs: fakeDocs,
      pagination: { page: 1, total: 1 }
    })
  })

  it('applies pagination when page is provided', async () => {
    const sbi = '123456789'
    const fakeDocs = [{ _id: 'a', sbi }]
    const skipMock = vi.fn().mockReturnThis()
    const limitMock = vi.fn().mockReturnThis()

    GrantPaymentsModel.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: skipMock,
      limit: limitMock,
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })
    GrantPaymentsModel.countDocuments.mockResolvedValue(45)

    const result = await fetchGrantPaymentsBySbi(sbi, 5)

    expect(skipMock).toHaveBeenCalledWith(40)
    expect(limitMock).toHaveBeenCalledWith(10)
    expect(result).toEqual({
      docs: fakeDocs,
      pagination: { page: 5, total: 5 }
    })
  })
})
