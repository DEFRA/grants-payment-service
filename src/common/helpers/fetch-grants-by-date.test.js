import { describe, it, expect, vi } from 'vitest'
import { fetchGrantPaymentsByDate } from './fetch-grants-by-date.js'
import GrantPaymentsModel from '#~/api/common/grant_payments.js'

vi.mock('#~/api/common/grant_payments.js')

describe('fetchGrantPaymentsByDate', () => {
  it('queries the model using the provided date and returns docs', async () => {
    const date = '2026-02-20'
    const fakeDocs = [{ _id: 'a' }]
    // mock chainable find().lean()
    GrantPaymentsModel.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue(fakeDocs)
    })

    const result = await fetchGrantPaymentsByDate(date)

    expect(GrantPaymentsModel.find).toHaveBeenCalledWith({
      'grants.dueDate': date
    })
    expect(result).toBe(fakeDocs)
  })
})
