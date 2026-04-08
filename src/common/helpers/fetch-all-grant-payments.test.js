import { describe, it, expect, vi } from 'vitest'
import { fetchAllGrantPayments } from './fetch-all-grant-payments.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')

describe('fetchAllGrantPayments', () => {
  it('queries all grant payments and returns lean docs', async () => {
    const fakeDocs = [{ _id: 'a' }, { _id: 'b' }]
    GrantPaymentsModel.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })

    const result = await fetchAllGrantPayments()

    expect(GrantPaymentsModel.find).toHaveBeenCalledWith({})
    expect(result).toBe(fakeDocs)
  })

  it('applies pagination when page is provided', async () => {
    const fakeDocs = [{ _id: 'a' }]
    const skipMock = vi.fn().mockReturnThis()
    const limitMock = vi.fn().mockReturnThis()

    GrantPaymentsModel.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: skipMock,
      limit: limitMock,
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })

    const result = await fetchAllGrantPayments(2)

    expect(skipMock).toHaveBeenCalledWith(10)
    expect(limitMock).toHaveBeenCalledWith(10)
    expect(result).toBe(fakeDocs)
  })
})
