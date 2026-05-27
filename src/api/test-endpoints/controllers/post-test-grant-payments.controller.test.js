import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { postTestGrantPaymentController } from './post-test-grant-payments.controller.js'
import grants from '#~/api/common/helpers/sample-data/grants.js'

vi.mock('#~/common/helpers/create-grant-payment.js', () => {
  return {
    createGrantPayment: vi.fn()
  }
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

describe('postTestGrantPaymentController', () => {
  const validPayload = grants[0]
  const mockLogger = { info: vi.fn(), error: vi.fn() }
  const mockReq = {
    payload: validPayload,
    id: 'test-id',
    logger: mockLogger
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 201 with id when creation succeeds', async () => {
    createGrantPayment.mockResolvedValue({ _id: 'abc123' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(createGrantPayment).toHaveBeenCalledWith(validPayload)
    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source).toEqual({
      id: 'abc123',
      message: 'Grant payments created'
    })
  })

  test('returns 201 with ids when payload is an array', async () => {
    const payloadArray = [validPayload, validPayload]
    createGrantPayment.mockResolvedValueOnce({ _id: 'abc123' })
    createGrantPayment.mockResolvedValueOnce({ _id: 'def456' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: payloadArray, logger: mockLogger },
      h
    )

    expect(createGrantPayment).toHaveBeenCalledTimes(2)
    expect(createGrantPayment).toHaveBeenNthCalledWith(1, validPayload)
    expect(createGrantPayment).toHaveBeenNthCalledWith(2, validPayload)
    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source).toEqual({
      ids: ['abc123', 'def456'],
      message: 'Grant payments created'
    })
  })

  test('returns 400 for validation error (ValidationError)', async () => {
    const error = new Error('validation failed')
    error.name = 'ValidationError'
    createGrantPayment.mockRejectedValue(error)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(result.statusCode).toBe(statusCodes.badRequest)
    expect(result.source).toMatchObject({
      message: 'Validation error',
      error: expect.objectContaining({ name: 'ValidationError' })
    })
  })

  test('returns 400 for validation error (ValidatorError)', async () => {
    const error = new Error('validation failed')
    error.name = 'ValidatorError'
    createGrantPayment.mockRejectedValue(error)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(result.statusCode).toBe(statusCodes.badRequest)
    expect(result.source).toMatchObject({
      message: 'Validation error',
      error: expect.objectContaining({ name: 'ValidatorError' })
    })
  })

  test('returns 500 for unexpected error', async () => {
    createGrantPayment.mockRejectedValue(new Error('db down'))

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({
      message: 'Internal Server Error',
      error: expect.objectContaining({ message: 'db down' })
    })
  })

  test('returns 500 when error is null/undefined', async () => {
    createGrantPayment.mockRejectedValue(undefined)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({
      message: 'Internal Server Error',
      error: undefined
    })
  })

  test('handles missing _id and id in created document', async () => {
    createGrantPayment.mockResolvedValue({ someOtherProp: 'value' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source.id).toBeUndefined()
  })

  test('returns 201 when incoming payload has no grants', async () => {
    createGrantPayment.mockResolvedValue({ _id: 'abc123' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: { sbi: '123' }, logger: mockLogger },
      h
    )

    expect(result.statusCode).toBe(statusCodes.created)
  })

  test('handles _id as an object with toString method', async () => {
    const mockId = { toString: () => 'string-id' }
    createGrantPayment.mockResolvedValue({ _id: mockId })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source.id).toBe('string-id')
  })
})
