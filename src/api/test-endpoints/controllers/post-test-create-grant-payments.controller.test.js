import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import GrantPaymentsModel from '../../common/grant_payments.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { postTestCreateGrantPaymentController } from './post-test-create-grant-payments.controller.js'

vi.mock('../../common/grant_payments.js', () => {
  return {
    default: {
      create: vi.fn()
    }
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

describe('postTestCreateGrantPaymentController', () => {
  const validPayload = {
    businessIdentifier: {
      sbi: '106284736',
      frn: '12544567',
      claimId: 'R00000004'
    },
    grants: [
      {
        sourceSystem: 'FPTT',
        paymentRequestNumber: 1,
        correlationId: '7cf9bd11-c791-42c9-bd28-fa0fec_id',
        invoiceNumber: 'R00000004-V001Q2',
        originalInvoiceNumber: '',
        agreementNumber: 'FPTT264870631',
        accountCode: 'SOS710',
        fundCode: 'DRD10',
        recoveryDate: '',
        originalSettlementDate: '',
        remittanceDescription: 'Farm Payments Technical Test Payment',
        totalAmount: '702.85',
        currency: 'GBP',
        marketingYear: '2026',
        payments: [
          {
            dueDate: '2026-06-05',
            totalAmount: '12.63',
            invoiceLines: [
              {
                schemeCode: 'CMOR1',
                description:
                  'Parcel 8083 - Assess moorland and produce a written record',
                amount: '12.63'
              }
            ]
            // status will default to 'pending'
          }
        ]
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 201 with id when creation succeeds', async () => {
    GrantPaymentsModel.create.mockResolvedValue({ _id: 'abc123' })

    const h = makeH()
    const result = await postTestCreateGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(GrantPaymentsModel.create).toHaveBeenCalledWith(validPayload)
    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source).toEqual({
      id: 'abc123',
      message: 'Grant payments created'
    })
  })

  test('returns 400 for validation error (ValidationError)', async () => {
    const error = new Error('validation failed')
    error.name = 'ValidationError'
    GrantPaymentsModel.create.mockRejectedValue(error)

    const h = makeH()
    const result = await postTestCreateGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.badRequest)
    expect(result.source).toMatchObject({ error: 'Validation error' })
  })

  test('returns 400 for validation error (ValidatorError)', async () => {
    const error = new Error('validation failed')
    error.name = 'ValidatorError'
    GrantPaymentsModel.create.mockRejectedValue(error)

    const h = makeH()
    const result = await postTestCreateGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.badRequest)
    expect(result.source).toMatchObject({ error: 'Validation error' })
  })

  test('returns 500 for unexpected error', async () => {
    GrantPaymentsModel.create.mockRejectedValue(new Error('db down'))

    const h = makeH()
    const result = await postTestCreateGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({ error: 'Internal Server Error' })
  })

  test('returns 500 when error is null/undefined', async () => {
    GrantPaymentsModel.create.mockRejectedValue(undefined)

    const h = makeH()
    const result = await postTestCreateGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({ error: 'Internal Server Error' })
  })

  test('handles missing _id in created document (using id property)', async () => {
    GrantPaymentsModel.create.mockResolvedValue({ id: 'id123' })

    const h = makeH()
    const result = await postTestCreateGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source.id).toBe('id123')
  })

  test('handles missing _id and id in created document', async () => {
    GrantPaymentsModel.create.mockResolvedValue({ someOtherProp: 'value' })

    const h = makeH()
    const result = await postTestCreateGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(statusCodes.created)
    expect(result.source.id).toBeUndefined()
  })
})
