import { describe, it, expect, vi } from 'vitest'
import { fetchGrantPaymentsBySbi } from './fetch-grant-payments-by-sbi.js'
import GrantPaymentsModel from '#~/api/common/grant_payments.js'

vi.mock('#~/api/common/grant_payments.js')

describe('fetchGrantPaymentsBySbi', () => {
  it('returns payments by the provided sbi', async () => {
    const sbi = '123456789'
    const fakeDocs = [{ _id: 'a', sbi }]
    GrantPaymentsModel.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })

    const result = await fetchGrantPaymentsBySbi(sbi)

    expect(GrantPaymentsModel.find).toHaveBeenCalledWith({ sbi })
    expect(result).toBe(fakeDocs)
  })
})
