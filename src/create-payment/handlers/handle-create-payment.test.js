import { describe, expect, it, vi } from 'vitest'

import { handleCreatePaymentEvent } from './handle-create-payment.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'

vi.mock('#~/common/helpers/create-grant-payment.js', () => {
  return {
    createGrantPayment: vi.fn()
  }
})
const validPayload = {
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

describe('handleCreatePaymentEvent', () => {
  it('logs receipt of a create_payment message', async () => {
    const logger = { info: vi.fn() }

    createGrantPayment.mockResolvedValue(validPayload)

    await handleCreatePaymentEvent('msg-1', validPayload, logger)

    expect(createGrantPayment).toHaveBeenCalledWith(validPayload)
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'msg-1',
        eventType: 'create_payment',
        sbi: '106284736'
      }),
      'Received create_payment message'
    )
  })
})
