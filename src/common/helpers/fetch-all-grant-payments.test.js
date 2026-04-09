import { describe, it, expect, vi } from 'vitest'
import { fetchAllGrantPayments } from './fetch-all-grant-payments.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')
vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn().mockReturnValue(10)
  }
}))

describe('fetchAllGrantPayments', () => {
  it('queries all grant payments and returns lean docs', async () => {
    const fakeDocs = [{ _id: 'a' }, { _id: 'b' }]
    GrantPaymentsModel.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })
    GrantPaymentsModel.countDocuments.mockResolvedValue(2)

    const result = await fetchAllGrantPayments()

    expect(GrantPaymentsModel.find).toHaveBeenCalledWith({})
    expect(result).toEqual({
      docs: fakeDocs,
      pagination: { page: 1, total: 1 }
    })
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
    GrantPaymentsModel.countDocuments.mockResolvedValue(15)

    const result = await fetchAllGrantPayments(2)

    expect(skipMock).toHaveBeenCalledWith(10)
    expect(limitMock).toHaveBeenCalledWith(10)
    expect(result).toEqual({
      docs: fakeDocs,
      pagination: { page: 2, total: 2 }
    })
  })
})
