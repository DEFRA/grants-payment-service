import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { prepareWithPaymentHubConfig } from '#~/common/helpers/payment-hub/prepare-with-payment-hub-config.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { postTestGrantPaymentController } from './post-test-grant-payments.controller.js'
import grants from '#~/api/common/helpers/sample-data/grants.js'

vi.mock('#~/common/helpers/create-grant-payment.js', () => {
  return {
    createGrantPayment: vi.fn()
  }
})

vi.mock(
  '#~/common/helpers/payment-hub/prepare-with-payment-hub-config.js',
  () => {
    return {
      prepareWithPaymentHubConfig: vi.fn()
    }
  }
)

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
    const mockPreparedPayload = { ...validPayload, prepared: true }
    prepareWithPaymentHubConfig.mockReturnValue(mockPreparedPayload)
    createGrantPayment.mockResolvedValue({ _id: 'abc123' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(prepareWithPaymentHubConfig).toHaveBeenCalledWith(validPayload)
    expect(createGrantPayment).toHaveBeenCalledWith(mockPreparedPayload)
    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source).toEqual({
      id: 'abc123',
      message: 'Grant payments created'
    })
  })

  test('returns 400 for validation error (ValidationError)', async () => {
    const error = new Error('validation failed')
    error.name = 'ValidationError'
    prepareWithPaymentHubConfig.mockReturnValue(validPayload)
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
    prepareWithPaymentHubConfig.mockReturnValue(validPayload)
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
    prepareWithPaymentHubConfig.mockReturnValue(validPayload)
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
    prepareWithPaymentHubConfig.mockReturnValue(validPayload)
    createGrantPayment.mockRejectedValue(undefined)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({
      message: 'Internal Server Error',
      error: undefined
    })
  })

  test('handles missing _id in created document (using id property)', async () => {
    prepareWithPaymentHubConfig.mockReturnValue(validPayload)
    createGrantPayment.mockResolvedValue({ id: 'id123' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source.id).toBe('id123')
  })

  test('handles missing _id and id in created document', async () => {
    prepareWithPaymentHubConfig.mockReturnValue(validPayload)
    createGrantPayment.mockResolvedValue({ someOtherProp: 'value' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source.id).toBeUndefined()
  })

  test('returns 201 when incoming payload has no grants', async () => {
    prepareWithPaymentHubConfig.mockReturnValue({ sbi: '123' })
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
    prepareWithPaymentHubConfig.mockReturnValue(validPayload)
    createGrantPayment.mockResolvedValue({ _id: mockId })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(mockReq, h)

    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source.id).toBe('string-id')
  })
})
