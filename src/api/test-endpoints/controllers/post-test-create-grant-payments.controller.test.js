import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import GrantPaymentsModel from '../../common/grant_payments.js'
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
        paymentRequestNumber: 1,
        correlationId: '7cf9bd11-c791-42c9-bd28-fa0fecb2d92c',
        invoiceNumber: 'R00000004-V001Q2',
        originalInvoiceNumber: '',
        agreementNumber: 'FPTT264870631',
        dueDate: '2026-06-05',
        recoveryDate: '',
        originalSettlementDate: '',
        remittanceDescription: 'Farm Payments Technical Test Payment',
        totalAmount: 702.85,
        currency: 'GBP',
        marketingYear: '2026',
        payments: [
          {
            amount: 12.63,
            description:
              'Parcel 8083 - Assess moorland and produce a written record',
            accountCode: 'SOS710',
            fundCode: 'DRD10',
            schemaCode: 'CMOR1',
            dueDate: '2026-06-05'
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
    expect(result.statusCode).toBe(201)
    expect(result.source).toEqual({
      id: 'abc123',
      message: 'Grant payments created'
    })
  })

  test('returns 400 for validation error', async () => {
    const error = new Error('validation failed')
    error.name = 'ValidationError'
    GrantPaymentsModel.create.mockRejectedValue(error)

    const h = makeH()
    const result = await postTestCreateGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(400)
    expect(result.source).toMatchObject({ error: 'Validation error' })
  })

  test('returns 500 for unexpected error', async () => {
    GrantPaymentsModel.create.mockRejectedValue(new Error('db down'))

    const h = makeH()
    const result = await postTestCreateGrantPaymentController.handler(
      { payload: validPayload },
      h
    )

    expect(result.statusCode).toBe(500)
    expect(result.source).toEqual({ error: 'Internal Server Error' })
  })
})
