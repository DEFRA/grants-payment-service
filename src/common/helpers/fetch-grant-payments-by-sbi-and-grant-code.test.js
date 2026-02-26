import { describe, it, expect, vi } from 'vitest'
import { fetchGrantPaymentsBySbiAndGrantCode } from './fetch-grant-payments-by-sbi-and-grant-code.js'
import GrantPaymentsModel from '#~/api/common/grant_payments.js'

vi.mock('#~/api/common/grant_payments.js')

describe('fetchGrantPaymentsBySbiAndGrantCode', () => {
  it('queries the model using the provided sbi and grantCode and returns docs', async () => {
    const sbi = '123456789'
    const grantCode = 'DRD10'
    const fakeDocs = [{ _id: 'a', sbi }]
    GrantPaymentsModel.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })

    const result = await fetchGrantPaymentsBySbiAndGrantCode(sbi, grantCode)

    expect(GrantPaymentsModel.find).toHaveBeenCalledWith({
      sbi,
      'grants.payments.fundCode': grantCode
    })
    expect(result).toBe(fakeDocs)
  })
})
