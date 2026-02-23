import { describe, it, expect, vi } from 'vitest'
import { processDailyPayments } from './payment-processor.js'
import { fetchGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'
import { getTodaysDate } from './date.js'

vi.mock('#~/common/helpers/fetch-grants-by-date.js', () => ({
  fetchGrantPaymentsByDate: vi.fn()
}))
vi.mock('#~/common/helpers/payment-hub/index.js', () => ({
  sendPaymentHubRequest: vi.fn()
}))

describe('processDailyPayments', () => {
  const logger = {
    info: vi.fn(),
    error: vi.fn()
  }
  const server = { logger }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses provided date, proxies each doc to PaymentHub and returns hub results', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [{ _id: '1' }, { _id: '2' }]
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)
    const responses = ['a', 'b']
    sendPaymentHubRequest
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])

    const result = await processDailyPayments(server, fakeDate)

    expect(fetchGrantPaymentsByDate).toHaveBeenCalledWith(fakeDate)
    expect(logger.info).toHaveBeenCalledWith(
      `Processing daily payments for date: ${fakeDate}`
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Found ${fakeDocs.length} payment record(s) matching due date ${fakeDate}`
    )
    expect(sendPaymentHubRequest).toHaveBeenCalledTimes(fakeDocs.length)
    expect(sendPaymentHubRequest).toHaveBeenNthCalledWith(
      1,
      server,
      fakeDocs[0]
    )
    expect(sendPaymentHubRequest).toHaveBeenNthCalledWith(
      2,
      server,
      fakeDocs[1]
    )
    expect(result).toEqual(responses)
  })

  it('defaults to today if no date supplied', async () => {
    const today = getTodaysDate()
    const fakeDocs = []
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)

    const result = await processDailyPayments(server)

    expect(fetchGrantPaymentsByDate).toHaveBeenCalledWith(today)
    expect(result).toEqual([])
  })

  it('logs and rethrows when the database query fails', async () => {
    const fakeDate = '2026-02-20'
    const error = new Error('db failure')
    fetchGrantPaymentsByDate.mockRejectedValue(error)

    await expect(processDailyPayments(server, fakeDate)).rejects.toThrow(error)

    expect(logger.error).toHaveBeenCalledWith(
      error,
      `Failed to query grant payments for date ${fakeDate}`
    )
  })

  it('logs individual hub failures and continues', async () => {
    const fakeDate = '2026-02-20'
    const fakeDocs = [{ _id: '1' }, { _id: '2' }, { _id: '3' }]
    fetchGrantPaymentsByDate.mockResolvedValue(fakeDocs)

    // first and third succeed, second fails
    sendPaymentHubRequest
      .mockResolvedValueOnce('ok1')
      .mockRejectedValueOnce(new Error('hub down'))
      .mockResolvedValueOnce('ok3')

    const result = await processDailyPayments(server, fakeDate)

    expect(result).toEqual(['ok1', null, 'ok3'])
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      `PaymentHub request failed for record ${fakeDocs[1]._id}`
    )
  })
})
