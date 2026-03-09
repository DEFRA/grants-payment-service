import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchGrantPaymentsBySbi } from '#~/common/helpers/fetch-grant-payments-by-sbi.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { postTestGrantPaymentController } from './post-test-grant-payments.controller.js'
import grants from '#~/api/common/helpers/sample-data/grants.js'

vi.mock('../../common/grant_payments.js', () => {
  return {
    default: {
      find: vi.fn()
    }
  }
})

vi.mock('#~/common/helpers/fetch-grant-payments-by-sbi.js', () => {
  return {
    fetchGrantPaymentsBySbi: vi.fn()
  }
})

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

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 201 with id when creation succeeds', async () => {
    createGrantPayment.mockResolvedValue({ _id: 'abc123' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(createGrantPayment).toHaveBeenCalledWith(validPayload)
    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source).toEqual({
      id: 'abc123',
      message: 'Grant payments created'
    })
  })

  test('returns 400 for validation error (ValidationError)', async () => {
    const error = new Error('validation failed')
    error.name = 'ValidationError'
    createGrantPayment.mockRejectedValue(error)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.badRequest)
    expect(result.source).toMatchObject({ error: 'Validation error' })
  })

  test('returns 400 for validation error (ValidatorError)', async () => {
    const error = new Error('validation failed')
    error.name = 'ValidatorError'
    createGrantPayment.mockRejectedValue(error)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.badRequest)
    expect(result.source).toMatchObject({ error: 'Validation error' })
  })

  test('returns 500 for unexpected error', async () => {
    createGrantPayment.mockRejectedValue(new Error('db down'))

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({ error: 'Internal Server Error' })
  })

  test('returns 500 when error is null/undefined', async () => {
    createGrantPayment.mockRejectedValue(undefined)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({ error: 'Internal Server Error' })
  })

  test('handles missing _id in created document (using id property)', async () => {
    createGrantPayment.mockResolvedValue({ id: 'id123' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source.id).toBe('id123')
  })

  test('handles missing _id and id in created document', async () => {
    createGrantPayment.mockResolvedValue({ someOtherProp: 'value' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source.id).toBeUndefined()
  })
  test('returns 400 when overlapping dates are found at the grant level', async () => {
    const existingPayments = [
      {
        sbi: '106284736',
        grants: [
          {
            dueDate: '2026-06-05',
            payments: []
          }
        ]
      }
    ]

    fetchGrantPaymentsBySbi.mockResolvedValue(existingPayments)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.badRequest)
    expect(result.source).toEqual({
      error: 'Validation error',
      message: 'For the given sbi overlapping grant payment already exists'
    })
  })

  test('returns 400 when overlapping dates are found at the payment level in existing records', async () => {
    const existingPayments = [
      {
        sbi: '106284736',
        grants: [
          {
            dueDate: '2026-06-06', // Different date at grant level
            payments: [{ dueDate: '2026-06-05' }] // Same date at payment level
          }
        ]
      }
    ]

    fetchGrantPaymentsBySbi.mockResolvedValue(existingPayments)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.badRequest)
    expect(result.source.message).toBe(
      'For the given sbi overlapping grant payment already exists'
    )
  })

  test('returns 201 when incoming grant has dueDate and no overlap', async () => {
    const incomingPayloadWithGrantDueDate = {
      ...validPayload,
      grants: [
        {
          ...validPayload.grants[0],
          dueDate: '2026-06-10'
        }
      ]
    }
    fetchGrantPaymentsBySbi.mockResolvedValue([])
    createGrantPayment.mockResolvedValue({ _id: 'abc123' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: incomingPayloadWithGrantDueDate },
      h
    )

    expect(result.statusCode).toBe(statusCodes.created)
  })

  test('returns 400 when incoming grant.dueDate overlaps with existing record', async () => {
    const incomingPayloadWithGrantDueDate = {
      ...validPayload,
      grants: [
        {
          ...validPayload.grants[0],
          dueDate: '2026-06-10'
        }
      ]
    }
    const existingPayments = [
      {
        sbi: '106284736',
        grants: [{ dueDate: '2026-06-10', payments: [] }]
      }
    ]
    fetchGrantPaymentsBySbi.mockResolvedValue(existingPayments)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: incomingPayloadWithGrantDueDate },
      h
    )

    expect(result.statusCode).toBe(statusCodes.badRequest)
  })

  test('returns 400 when overlapping dates are found', async () => {
    const existingPayments = [
      {
        sbi: '106284736',
        grants: [
          {
            dueDate: '2026-06-05',
            payments: [{ dueDate: '2026-06-05' }]
          }
        ]
      }
    ]

    fetchGrantPaymentsBySbi.mockResolvedValue(existingPayments)

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(fetchGrantPaymentsBySbi).toHaveBeenCalledWith('106284736')
    expect(result.statusCode).toBe(statusCodes.badRequest)
    expect(result.source).toEqual({
      error: 'Validation error',
      message: 'For the given sbi overlapping grant payment already exists'
    })
    expect(createGrantPayment).not.toHaveBeenCalled()
  })

  test('returns 201 when no overlapping dates are found', async () => {
    fetchGrantPaymentsBySbi.mockResolvedValue([])
    createGrantPayment.mockResolvedValue({ _id: 'abc123' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(fetchGrantPaymentsBySbi).toHaveBeenCalledWith('106284736')
    expect(result.statusCode).toBe(statusCodes.created)
    expect(createGrantPayment).toHaveBeenCalled()
  })

  test('returns 201 when incoming payload has no grants', async () => {
    fetchGrantPaymentsBySbi.mockResolvedValue([])
    createGrantPayment.mockResolvedValue({ _id: 'abc123' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: { sbi: '123' } },
      h
    )

    expect(result.statusCode).toBe(statusCodes.created)
  })

  test('returns 201 when existing record has no grants', async () => {
    fetchGrantPaymentsBySbi.mockResolvedValue([{ sbi: '106284736' }])
    createGrantPayment.mockResolvedValue({ _id: 'abc123' })

    const h = makeH()
    const result = await postTestGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.created)
  })
})
