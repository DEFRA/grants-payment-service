import { describe, it, expect, vi } from 'vitest'
import { fetchGrantPaymentsByDate } from './fetch-grants-by-date.js'
import GrantPaymentsModel from '#~/api/common/grant_payments.js'

vi.mock('#~/api/common/grant_payments.js')

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
      expect.objectContaining({
        $project: expect.objectContaining({
          grants: expect.any(Object)
        })
      })
    ])

    // inspect the filter condition from the captured pipeline
    const calledPipeline = GrantPaymentsModel.aggregate.mock.calls[0][0]
    const cond =
      calledPipeline[1].$project.grants.$map.in.$mergeObjects[1].payments
        .$filter.cond
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
      expect.any(Object)
    ])

    const calledPipeline = GrantPaymentsModel.aggregate.mock.calls[0][0]
    const cond =
      calledPipeline[1].$project.grants.$map.in.$mergeObjects[1].payments
        .$filter.cond
    expect(cond).toEqual({
      $and: [{ $eq: ['$$p.dueDate', date] }, { $eq: ['$$p.status', 'pending'] }]
    })

    expect(result).toBe(fakeDocs)
  })
})
