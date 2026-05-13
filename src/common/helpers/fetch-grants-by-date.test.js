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
    const previousDay = '2026-02-19'

    const expectedMatch = {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: { dueDate: { $in: [date, previousDay] } }
          }
        }
      }
    }

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith([
      { $match: expectedMatch },
      {
        $project: {
          sbi: 1,
          frn: 1,
          claimId: 1,
          grants: {
            $map: {
              input: '$grants',
              as: 'g',
              in: {
                $mergeObjects: [
                  '$$g',
                  {
                    matchedPayments: {
                      $filter: {
                        input: '$$g.payments',
                        as: 'p',
                        cond: {
                          $and: [{ $in: ['$$p.dueDate', [date, previousDay]] }]
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $match: {
          grants: {
            $elemMatch: { 'matchedPayments.0': { $exists: true } }
          }
        }
      }
    ])

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
    const previousDay = '2026-02-19'

    const expectedMatch = {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: {
              dueDate: { $in: [date, previousDay] },
              status: 'pending'
            }
          }
        }
      }
    }

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith([
      { $match: expectedMatch },
      {
        $project: {
          sbi: 1,
          frn: 1,
          claimId: 1,
          grants: {
            $map: {
              input: '$grants',
              as: 'g',
              in: {
                $mergeObjects: [
                  '$$g',
                  {
                    matchedPayments: {
                      $filter: {
                        input: '$$g.payments',
                        as: 'p',
                        cond: {
                          $and: [
                            { $in: ['$$p.dueDate', [date, previousDay]] },
                            { $eq: ['$$p.status', 'pending'] }
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $match: {
          grants: {
            $elemMatch: { 'matchedPayments.0': { $exists: true } }
          }
        }
      }
    ])

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
      expect.arrayContaining([
        { $skip: 10 },
        { $limit: 10 },
        { $sort: { createdAt: -1 } }
      ])
    )

    expect(result).toEqual({
      docs: fakeDocs,
      totalDocs: 1,
      pagination: { page: 2, total: 1 }
    })
  })

  it('includes $sort when limit is provided without page', async () => {
    await fetchGrantPaymentsByDate(date, null, 10)

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $limit: 10 }, { $sort: { createdAt: -1 } }])
    )
  })
})
