import { afterAll } from 'vitest'
import mongoose from 'mongoose'
import GrantPaymentsModel from './grant_payments.js'

describe('grant_payments schema', () => {
  afterAll(() => {
    delete mongoose.connection.models.grant_payments
  })

  test('should fail validation when required fields are missing', () => {
    const doc = new GrantPaymentsModel({})
    const err = doc.validateSync()

    expect(err).toBeTruthy()
    expect(err.errors).toBeTruthy()
    expect(err.errors.businessIdentifier).toBeTruthy()
  })

  test('should pass validation with required fields present', () => {
    const valid = {
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
          originalInvoiceNumber: 'R00000004-V001Q1',
          agreementNumber: 'FPTT264870631',
          totalAmount: 702.85,
          currency: 'GBP',
          marketingYear: '2026',
          payments: [
            {
              amount: 12.63,
              description: '2026-06-05: Parcel 8083',
              accountCode: 'SOS710',
              fundCode: 'DRD10',
              schemaCode: 'CMOR1',
              dueDate: '2026-06-05',
              status: 'pending'
            }
          ]
        }
      ]
    }

    const doc = new GrantPaymentsModel(valid)
    expect(doc.validateSync()).toBeUndefined()
  })
})
