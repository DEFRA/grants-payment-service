import { describe, it, expect, vi } from 'vitest'
import {
  fetchGrantPaymentsByDate,
  streamGrantPaymentsByDate,
  streamGrantPaymentsByCorrelationIds
} from './fetch-grants-by-date.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')
vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'disabledSchemeCodes') return ['PA3']
      return 10
    })
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
    const nextDay = '2026-02-21'

    const expectedMatch = {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: { dueDate: { $lte: nextDay } }
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
                          $and: [{ $lte: ['$$p.dueDate', nextDay] }]
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
    const nextDay = '2026-02-21'

    const expectedMatch = {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: {
              dueDate: { $lte: nextDay },
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
                            { $lte: ['$$p.dueDate', nextDay] },
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

describe('streamGrantPaymentsByDate', () => {
  let date

  beforeEach(() => {
    date = '2026-02-20'
    const mockCursor = {
      next: vi.fn()
    }
    GrantPaymentsModel.aggregate.mockReturnValue({
      cursor: vi.fn().mockReturnValue(mockCursor)
    })
  })

  it('builds pipeline with date only', () => {
    const nextDay = '2026-02-21'

    streamGrantPaymentsByDate(date)

    const expectedMatch = {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: { dueDate: { $lte: nextDay } }
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
                          $and: [{ $lte: ['$$p.dueDate', nextDay] }]
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
  })

  it('builds pipeline with status', () => {
    const status = 'pending'
    const nextDay = '2026-02-21'

    streamGrantPaymentsByDate(date, status)

    const expectedMatch = {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: {
              dueDate: { $lte: nextDay },
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
                            { $lte: ['$$p.dueDate', nextDay] },
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
  })

  it('builds pipeline with limit and page', () => {
    streamGrantPaymentsByDate(date, null, 10, 2)

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        { $skip: 10 },
        { $limit: 10 },
        { $sort: { createdAt: -1 } }
      ])
    )
  })

  it('builds pipeline with limit only', () => {
    streamGrantPaymentsByDate(date, null, 10)

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $limit: 10 }, { $sort: { createdAt: -1 } }])
    )
  })
})

describe('streamGrantPaymentsByCorrelationIds', () => {
  let correlationIds

  beforeEach(() => {
    correlationIds = ['corr1', 'corr2']
    const mockCursor = {
      next: vi.fn()
    }
    GrantPaymentsModel.aggregate.mockReturnValue({
      cursor: vi.fn().mockReturnValue(mockCursor)
    })
  })

  it('builds pipeline with correlationIds only', () => {
    streamGrantPaymentsByCorrelationIds(correlationIds)

    const expectedMatch = {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: {
              correlationId: { $in: correlationIds },
              invoiceLines: {
                $not: {
                  $elemMatch: {
                    schemeCode: { $in: ['PA3'] }
                  }
                }
              }
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
                            { $in: ['$$p.correlationId', correlationIds] },
                            true,
                            {
                              $not: {
                                $anyElementTrue: {
                                  $map: {
                                    input: '$$p.invoiceLines',
                                    as: 'il',
                                    in: { $in: ['$$il.schemeCode', ['PA3']] }
                                  }
                                }
                              }
                            }
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
  })

  it('builds pipeline with status', () => {
    const status = 'pending'

    streamGrantPaymentsByCorrelationIds(correlationIds, status)

    const expectedMatch = {
      grants: {
        $elemMatch: {
          payments: {
            $elemMatch: {
              correlationId: { $in: correlationIds },
              status: 'pending',
              invoiceLines: {
                $not: {
                  $elemMatch: {
                    schemeCode: { $in: ['PA3'] }
                  }
                }
              }
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
                            { $in: ['$$p.correlationId', correlationIds] },
                            { $eq: ['$$p.status', 'pending'] },
                            {
                              $not: {
                                $anyElementTrue: {
                                  $map: {
                                    input: '$$p.invoiceLines',
                                    as: 'il',
                                    in: { $in: ['$$il.schemeCode', ['PA3']] }
                                  }
                                }
                              }
                            }
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
  })
})
