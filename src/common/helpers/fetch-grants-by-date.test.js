import { describe, it, expect, vi } from 'vitest'
import { fetchGrantPaymentsByDate } from './fetch-grants-by-date.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')
vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn().mockReturnValue(10)
  }
}))

describe('fetchGrantPaymentsByDate', () => {
  let date, fakeDocs

  beforeEach(() => {
    date = '2026-02-20'
    fakeDocs = [
      { _id: 'a', grants: [{ payments: [{ dueDate: '2026-02-20' }] }] }
    ]
    // mock behaviour
    GrantPaymentsModel.aggregate.mockResolvedValue(fakeDocs)
    GrantPaymentsModel.countDocuments.mockResolvedValue(1)
  })

  it('builds a simple pipeline when only date is provided', async () => {
    const result = await fetchGrantPaymentsByDate(date)

    const expectedMatch = {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: { dueDate: date }
          }
        }
      }
    }

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        { $match: expectedMatch },
        { $sort: { createdAt: -1 } },
        expect.objectContaining({ $project: expect.any(Object) }),
        expect.objectContaining({
          $match: {
            grants: {
              $elemMatch: { 'payments.0': { $exists: true } }
            }
          }
        })
      ])
    )

    expect(GrantPaymentsModel.countDocuments).toHaveBeenCalledWith(
      expectedMatch
    )

    expect(result).toEqual({
      docs: fakeDocs,
      totalDocs: 1,
      pagination: { page: 1, total: 1 }
    })
  })

  it('includes status in the pipeline when provided', async () => {
    const result = await fetchGrantPaymentsByDate(date, 'pending')

    const expectedMatch = {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: { dueDate: date, status: 'pending' }
          }
        }
      }
    }

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        { $match: expectedMatch },
        { $sort: { createdAt: -1 } }
      ])
    )

    expect(GrantPaymentsModel.countDocuments).toHaveBeenCalledWith(
      expectedMatch
    )

    expect(result).toEqual({
      docs: fakeDocs,
      totalDocs: 1,
      pagination: { page: 1, total: 1 }
    })
  })

  it('applies pagination when page is provided', async () => {
    const result = await fetchGrantPaymentsByDate(date, null, 10, 2)

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $skip: 10 }, { $limit: 10 }])
    )

    expect(result).toEqual({
      docs: fakeDocs,
      totalDocs: 1,
      pagination: { page: 2, total: 1 }
    })
  })
})
