import { describe, expect, it, vi } from 'vitest'

import { handleCreatePaymentEvent } from './handle-create-payment.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'

vi.mock('#~/common/helpers/create-grant-payment.js', () => {
  return {
    createGrantPayment: vi.fn()
  }
})
const validPayload = {
  id: '12-34-56-78-90',
  source: 'farming-grants-agreements-api',
  specVersion: '1.0',
  type: 'cloud.defra.dev.farming-grants-agreements-api.payment.create',
  datacontenttype: 'application/json',
  data: {
    sbi: '106284736',
    frn: '12544567',
    claimId: 'R00000004',
    grants: [
      {
        paymentRequestNumber: 1,
        correlationId: '7cf9bd11-c791-42c9-bd28-fa0fec_id',
        invoiceNumber: 'R00000004-V001Q2',
        originalInvoiceNumber: '',
        agreementNumber: 'FPTT264870631',
        dueDate: '2026-06-05',
        recoveryDate: '',
        originalSettlementDate: '',
        remittanceDescription: 'Farm Payments Technical Test Payment',
        totalAmount: '702.85',
        currency: 'GBP',
        marketingYear: '2026',
        payments: [
          {
            amount: '12.63',
            description:
              'Parcel 8083 - Assess moorland and produce a written record',
            accountCode: 'SOS710',
            fundCode: 'DRD10',
            schemaCode: 'CMOR1',
            dueDate: '2026-06-05',
            invoiceLines: [
              {
                schemeCode: 'CMOR1',
                description:
                  'Parcel 6000 - Assess moorland and produce a written record',
                amount: '12.63'
              }
            ]
          }
        ]
      }
    ]
  }
}

describe('handleCreatePaymentEvent', () => {
  it('logs receipt of a create_payment message', async () => {
    const logger = { info: vi.fn() }

    createGrantPayment.mockResolvedValue(validPayload)

    const wrappedPayload = { data: validPayload }
    await handleCreatePaymentEvent('msg-1', wrappedPayload, logger)

    expect(createGrantPayment).toHaveBeenCalledWith(validPayload)
    expect(logger.info).toHaveBeenCalledWith(
      {
        messageId: 'msg-1',
        eventType: 'create_payment',
        sbi: validPayload.sbi
      },
      `Received create_payment payload is  ${JSON.stringify(wrappedPayload, null, 2)}`
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Managed to successfully create grantPayment entry ${JSON.stringify(validPayload)}`
    )
  })
})
