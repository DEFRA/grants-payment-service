import { describe, it, expect, vi } from 'vitest'
import { fetchGrantPaymentsBySbiAndGrantCode } from './fetch-grant-payments-by-sbi-and-grant-code.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')

describe('fetchGrantPaymentsBySbiAndGrantCode', () => {
  it('queries the model using the provided sbi and grantCode and returns docs', async () => {
    const sbi = '123456789'
    const grantCode = 'DRD10'
    const fakeDocs = [{ _id: 'a', sbi }]
    GrantPaymentsModel.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })

    const result = await fetchGrantPaymentsBySbiAndGrantCode(sbi, grantCode)

    expect(GrantPaymentsModel.find).toHaveBeenCalledWith({
      sbi,
      'grants.fundCode': grantCode
    })
    expect(result).toBe(fakeDocs)
  })

  it('applies pagination when page is provided', async () => {
    const sbi = '123456789'
    const grantCode = 'DRD10'
    const fakeDocs = [{ _id: 'a', sbi }]
    const skipMock = vi.fn().mockReturnThis()
    const limitMock = vi.fn().mockReturnThis()

    GrantPaymentsModel.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: skipMock,
      limit: limitMock,
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })

    const result = await fetchGrantPaymentsBySbiAndGrantCode(sbi, grantCode, 3)

    expect(skipMock).toHaveBeenCalledWith(20)
    expect(limitMock).toHaveBeenCalledWith(10)
    expect(result).toBe(fakeDocs)
  })
})
