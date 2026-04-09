import { describe, it, expect, vi } from 'vitest'
import { fetchGrantPaymentsBySbiAndFundCode } from './fetch-grant-payments-by-sbi-and-fund-code.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')
vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn().mockReturnValue(10)
  }
}))

describe('fetchGrantPaymentsBySbiAndFundCode', () => {
  it('queries the model using the provided sbi and fundCode and returns docs', async () => {
    const sbi = '123456789'
    const fundCode = 'DRD10'
    const fakeDocs = [{ _id: 'a', sbi }]
    GrantPaymentsModel.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })
    GrantPaymentsModel.countDocuments.mockResolvedValue(2)

    const result = await fetchGrantPaymentsBySbiAndFundCode(sbi, fundCode)

    expect(GrantPaymentsModel.find).toHaveBeenCalledWith({
      sbi,
      'grants.payments.invoiceLines.fundCode': fundCode
    })
    expect(result).toEqual({
      docs: fakeDocs,
      pagination: { page: 1, total: 1 }
    })
  })

  it('applies pagination when page is provided', async () => {
    const sbi = '123456789'
    const fundCode = 'DRD10'
    const fakeDocs = [{ _id: 'a', sbi }]
    const skipMock = vi.fn().mockReturnThis()
    const limitMock = vi.fn().mockReturnThis()

    GrantPaymentsModel.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: skipMock,
      limit: limitMock,
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })
    GrantPaymentsModel.countDocuments.mockResolvedValue(25)

    const result = await fetchGrantPaymentsBySbiAndFundCode(sbi, fundCode, 3)

    expect(skipMock).toHaveBeenCalledWith(20)
    expect(limitMock).toHaveBeenCalledWith(10)
    expect(result).toEqual({
      docs: fakeDocs,
      pagination: { page: 3, total: 3 }
    })
  })
})
