import { describe, it, expect, vi } from 'vitest'
import { fetchGrantPaymentsByDate } from './fetch-grants-by-date.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

vi.mock('#~/api/common/models/grant_payments.js')

describe('fetchGrantPaymentsByDate', () => {
  let date, fakeDocs

  beforeEach(() => {
    date = '2026-02-20'
    fakeDocs = [{ _id: 'a' }]
    // mock aggregate behaviour
    GrantPaymentsModel.aggregate.mockResolvedValue(fakeDocs)
  })

  it('builds a simple pipeline when only date is provided', async () => {
    const result = await fetchGrantPaymentsByDate(date)

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith([
      { $match: { 'grants.payments.dueDate': date } },
      { $sort: { createdAt: -1 } },
      expect.objectContaining({
        $project: expect.objectContaining({
          sbi: 1,
          frn: 1,
          claimId: 1,
          grants: expect.any(Object)
        })
      })
    ])

    // inspect the filter condition from the captured pipeline
    const calledPipeline = GrantPaymentsModel.aggregate.mock.calls[0][0]
    const projectStage = calledPipeline.find((s) => s.$project)
    const cond =
      projectStage.$project.grants.$map.in.$mergeObjects[1].payments.$filter
        .cond
    expect(cond).toEqual({ $and: [{ $eq: ['$$p.dueDate', date] }] })

    expect(result).toBe(fakeDocs)
  })

  it('includes status in the pipeline when provided', async () => {
    const result = await fetchGrantPaymentsByDate(date, 'pending')

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          'grants.payments.dueDate': date,
          'grants.payments.status': 'pending'
        }
      },
      { $sort: { createdAt: -1 } },
      expect.any(Object)
    ])

    const calledPipeline = GrantPaymentsModel.aggregate.mock.calls[0][0]
    const projectStage = calledPipeline.find((s) => s.$project)
    const cond =
      projectStage.$project.grants.$map.in.$mergeObjects[1].payments.$filter
        .cond
    expect(cond).toEqual({
      $and: [{ $eq: ['$$p.dueDate', date] }, { $eq: ['$$p.status', 'pending'] }]
    })

    expect(result).toBe(fakeDocs)
  })

  it('applies pagination when page is provided', async () => {
    const result = await fetchGrantPaymentsByDate(date, null, 2)

    expect(GrantPaymentsModel.aggregate).toHaveBeenCalledWith([
      { $match: { 'grants.payments.dueDate': date } },
      { $sort: { createdAt: -1 } },
      { $skip: 10 },
      { $limit: 10 },
      expect.any(Object)
    ])

    expect(result).toBe(fakeDocs)
  })
})
