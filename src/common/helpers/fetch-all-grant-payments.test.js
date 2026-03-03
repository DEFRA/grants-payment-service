import { describe, it, expect, vi } from 'vitest'
import { fetchAllGrantPayments } from './fetch-all-grant-payments.js'
import GrantPaymentsModel from '#~/api/common/grant_payments.js'

vi.mock('#~/api/common/grant_payments.js')

describe('fetchAllGrantPayments', () => {
  it('queries all grant payments and returns lean docs', async () => {
    const fakeDocs = [{ _id: 'a' }, { _id: 'b' }]
    GrantPaymentsModel.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })

    const result = await fetchAllGrantPayments()

    expect(GrantPaymentsModel.find).toHaveBeenCalledWith({})
    expect(result).toBe(fakeDocs)
  })
})
