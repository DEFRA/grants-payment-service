import { describe, it, expect, vi, beforeEach } from 'vitest'
import Boom from '@hapi/boom'
import { postTestProcessPaymentsController } from './post-test-process-payments.controller.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'

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
    const fakeResult = ['foo']
    processDailyPayments.mockResolvedValue(fakeResult)

    const h = makeH()
    const req = {
      params: { date: fakeDate },
      server: {},
      logger: { error: vi.fn() }
    }

    const response = await postTestProcessPaymentsController.handler(req, h)

    expect(processDailyPayments).toHaveBeenCalledWith(req.server, fakeDate)
    expect(response.statusCode).toBe(statusCodes.ok)
    expect(response.source).toEqual({ result: fakeResult })
  })

  it('passes undefined when date not supplied', async () => {
    const fakeResult = []
    processDailyPayments.mockResolvedValue(fakeResult)

    const h = makeH()
    const req = { params: {}, server: {}, logger: { error: vi.fn() } }

    const response = await postTestProcessPaymentsController.handler(req, h)

    expect(processDailyPayments).toHaveBeenCalledWith(req.server, undefined)
    expect(response.source).toEqual({ result: fakeResult })
  })

  it('forwards Boom errors unchanged', async () => {
    const boomError = Boom.badRequest('nope')
    processDailyPayments.mockRejectedValue(boomError)

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
    processDailyPayments.mockRejectedValue(error)

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
      message: 'Failed to trigger test process payments'
    })
  })
})
