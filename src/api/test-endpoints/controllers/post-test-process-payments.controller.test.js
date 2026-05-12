import { describe, it, expect, vi, beforeEach } from 'vitest'
import Boom from '@hapi/boom'
import { postTestProcessPaymentsController } from './post-test-process-payments.controller.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { getTomorrowsDate } from '#~/common/helpers/date.js'

vi.mock('#~/common/helpers/payment-processor.js', () => ({
  processDailyPayments: vi.fn()
}))

describe('postTestProcessPaymentsController', () => {
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

  it('calls processor with provided date and returns 200', async () => {
    const fakeDate = '2026-02-20'
    const fakeResults = [{ _id: 'payment1' }, { _id: 'payment2' }]
    processDailyPayments.mockResolvedValue({
      results: fakeResults,
      backgroundTasks: [],
      fetchDuration: '10.00',
      processDuration: '20.00',
      sendDuration: '5.00'
    })

    const h = makeH()
    const req = {
      params: { date: fakeDate },
      server: { logger: { info: vi.fn() } },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    const response = await postTestProcessPaymentsController.handler(req, h)

    expect(processDailyPayments).toHaveBeenCalledWith(req.server, 10, fakeDate)
    expect(response.statusCode).toBe(statusCodes.ok)
    expect(response.source).toEqual({
      message: `Triggered daily payment processing for ${fakeDate}, showing first 10 payments with full details, check logs for more details`,
      result: fakeResults.map((r) => ({ db: r }))
    })
  })

  it('uses current date when date not supplied', async () => {
    const fakeResults = []
    processDailyPayments.mockResolvedValue({
      results: fakeResults,
      backgroundTasks: [],
      fetchDuration: '5.00',
      processDuration: '0.00',
      sendDuration: '0.00'
    })

    const h = makeH()
    const req = {
      params: {},
      server: { logger: { info: vi.fn() } },
      logger: { info: vi.fn(), error: vi.fn() }
    }

    const response = await postTestProcessPaymentsController.handler(req, h)

    expect(processDailyPayments).toHaveBeenCalledWith(req.server, 10, undefined)
    expect(response.source).toEqual({
      message: `Triggered daily payment processing for ${getTomorrowsDate()}, showing first 10 payments with full details, check logs for more details`,
      result: fakeResults.map((r) => ({ db: r }))
    })
  })

  it('forwards Boom errors unchanged', async () => {
    const boomError = Boom.badRequest('nope')
    processDailyPayments.mockImplementation(() => {
      throw boomError
    })

    const h = makeH()
    const req = {
      params: { date: 'x' },
      server: {},
      logger: { error: vi.fn() }
    }

    const response = await postTestProcessPaymentsController.handler(req, h)
    expect(response).toBe(boomError)
  })

  it('logs and responds 500 on generic failure', async () => {
    const error = new Error('kaboom')
    processDailyPayments.mockImplementation(() => {
      throw error
    })

    const h = makeH()
    const logger = { error: vi.fn() }
    const req = { params: { date: '2026-02-20' }, server: {}, logger }

    const response = await postTestProcessPaymentsController.handler(req, h)

    expect(logger.error).toHaveBeenCalledWith(
      error,
      `Error triggering test process payments`
    )
    expect(response.statusCode).toBe(statusCodes.internalServerError)
    expect(response.source).toMatchObject({
      message: 'Failed to trigger test process payments',
      error: serializeError(error)
    })
  })

  it('handles background tasks with payment hub responses', async () => {
    const fakeDate = '2026-02-20'
    const fakeResults = [{ _id: 'payment1' }]
    const fakeResponse = { paymentHubId: 'hub-123', status: 'sent' }
    const resolvedTask = Promise.resolve(fakeResponse)

    processDailyPayments.mockResolvedValueOnce({
      results: fakeResults,
      backgroundTasks: [resolvedTask],
      fetchDuration: '10.00',
      processDuration: '20.00',
      sendDuration: '5.00'
    })

    processDailyPayments.mockResolvedValueOnce({
      results: [{ _id: 'payment2' }],
      fetchDuration: '5.00',
      processDuration: '10.00',
      sendDuration: '2.00'
    })

    const h = makeH()
    const logger = { info: vi.fn(), error: vi.fn() }
    const req = {
      params: { date: fakeDate },
      server: { logger: { info: vi.fn() } },
      logger
    }

    const response = await postTestProcessPaymentsController.handler(req, h)

    expect(response.statusCode).toBe(statusCodes.ok)
    expect(response.source.result).toEqual([
      { ...fakeResponse, db: fakeResults[0] }
    ])

    // Wait for background processDailyPayments promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Processed 2 daily payment(s)')
    )
  })

  it('filters out null/undefined background tasks', async () => {
    const fakeResults = [{ _id: 'payment1' }]
    const fakeResponse = { paymentHubId: 'hub-123' }

    processDailyPayments.mockResolvedValueOnce({
      results: fakeResults,
      backgroundTasks: [null, Promise.resolve(fakeResponse), undefined],
      fetchDuration: '10.00',
      processDuration: '20.00',
      sendDuration: '5.00'
    })

    processDailyPayments.mockResolvedValueOnce({
      results: [],
      fetchDuration: '0.00',
      processDuration: '0.00',
      sendDuration: '0.00'
    })

    const h = makeH()
    const logger = { info: vi.fn(), error: vi.fn() }
    const req = {
      params: {},
      server: { logger: { info: vi.fn() } },
      logger
    }

    const response = await postTestProcessPaymentsController.handler(req, h)

    expect(response.statusCode).toBe(statusCodes.ok)
    expect(response.source.result).toEqual([
      { ...fakeResponse, db: fakeResults[0] }
    ])
  })

  it('handles undefined backgroundTasks with fallback to empty array', async () => {
    const fakeResults = [{ _id: 'payment1' }]

    processDailyPayments.mockResolvedValueOnce({
      results: fakeResults,
      backgroundTasks: undefined,
      fetchDuration: '10.00',
      processDuration: '20.00',
      sendDuration: '5.00'
    })

    processDailyPayments.mockResolvedValueOnce({
      results: [],
      fetchDuration: '0.00',
      processDuration: '0.00',
      sendDuration: '0.00'
    })

    const h = makeH()
    const logger = { info: vi.fn(), error: vi.fn() }
    const req = {
      params: { date: '2026-02-20' },
      server: { logger: { info: vi.fn() } },
      logger
    }

    const response = await postTestProcessPaymentsController.handler(req, h)

    expect(response.statusCode).toBe(statusCodes.ok)
    expect(response.source.result).toEqual([{ db: fakeResults[0] }])
  })
})
