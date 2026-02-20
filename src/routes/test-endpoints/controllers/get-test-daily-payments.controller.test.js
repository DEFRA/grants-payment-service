import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTestDailyPaymentsController } from './get-test-daily-payments.controller.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { fetchGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'
import { getTodaysDate } from '#~/common/helpers/date.js'

vi.mock('#~/common/helpers/fetch-grants-by-date.js', () => ({
  fetchGrantPaymentsByDate: vi.fn()
}))

describe('getTestDailyPaymentsController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const makeH = () => {
    const res = { statusCode: 200, source: undefined }
    return {
      response: (payload) => ({
        code: (status) => {
          res.statusCode = status
          res.source = payload
          return res
        }
      })
    }
  }

  it('returns docs for provided date', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [{ _id: '1' }]
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)

    const h = makeH()
    const result = await getTestDailyPaymentsController.handler(
      { query: { date: fakeDate }, logger: { error: vi.fn() } },
      h
    )

    expect(fetchGrantPaymentsByDate).toHaveBeenCalledWith(fakeDate)
    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual({ date: fakeDate, docs: fakeDocs })
  })

  it('defaults to today when no date supplied', async () => {
    const today = getTodaysDate()
    const fakeDocs = []
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)

    const h = makeH()
    const result = await getTestDailyPaymentsController.handler(
      { query: {}, logger: { error: vi.fn() } },
      h
    )

    expect(fetchGrantPaymentsByDate).toHaveBeenCalledWith(today)
    expect(result.source).toEqual({ date: today, docs: fakeDocs })
  })

  it('handles non-boom errors and returns 500', async () => {
    const error = new Error('oops')
    fetchGrantPaymentsByDate.mockRejectedValue(error)
    const h = makeH()
    const logger = { error: vi.fn() }

    const result = await getTestDailyPaymentsController.handler(
      { query: { date: '2026-02-20' }, logger },
      h
    )

    expect(logger.error).toHaveBeenCalledWith(
      error,
      `Error getting test daily payments`
    )
    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toMatchObject({
      message: 'Failed to get test daily payments'
    })
  })

  it('returns boom errors unchanged', async () => {
    const boomError = {
      isBoom: true,
      output: { statusCode: 400 },
      message: 'bad'
    }
    fetchGrantPaymentsByDate.mockRejectedValue(boomError)
    const h = makeH()
    const logger = { error: vi.fn() }

    const result = await getTestDailyPaymentsController.handler(
      { query: { date: '2026-02-20' }, logger },
      h
    )

    expect(result).toBe(boomError)
  })
})
