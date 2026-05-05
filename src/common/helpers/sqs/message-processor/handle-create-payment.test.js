import { describe, expect, it, vi } from 'vitest'

import { handleCreatePaymentEvent } from './handle-create-payment.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { transformFpttPaymentDataToPaymentHubFormat } from '#~/common/helpers/payment-hub/fptt-data-transformer.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'

vi.mock('#~/common/helpers/create-grant-payment.js', () => {
  return {
    createGrantPayment: vi.fn()
  }
})

vi.mock('#~/common/helpers/payment-hub/fptt-data-transformer.js', () => {
  return {
    transformFpttPaymentDataToPaymentHubFormat: vi.fn()
  }
})

const validPayload = {
  id: '12-34-56-78-90',
  source: 'farming-grants-agreements-api',
  specVersion: '1.0',
  type: 'cloud.defra.dev.farming-grants-agreements-api.payment.create',
  datacontenttype: 'application/json',
  data: sampleData.grants[0]
}

describe('handleCreatePaymentEvent', () => {
  it('logs receipt of a create_payment message', async () => {
    const logger = { info: vi.fn() }
    createGrantPayment.mockResolvedValue(validPayload)

    await handleCreatePaymentEvent('msg-1', validPayload, logger)

    expect(createGrantPayment).toHaveBeenCalledWith(sampleData.grants[0])
    expect(logger.info).toHaveBeenCalledWith(
      {
        messageId: 'msg-1',
        eventType: validPayload.type,
        sbi: sampleData.grants[0].sbi
      },
      `Received create_payment payload is  ${JSON.stringify(validPayload, null, 2)}`
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Managed to successfully create grantPayment entry ${JSON.stringify(validPayload)}`
    )
  })

  it('logs dry-run payment hub data for each payment', async () => {
    const logger = { info: vi.fn() }
    const grantPayment = {
      sbi: '106284736',
      frn: '12544567',
      claimId: 'R00000004',
      grants: [
        {
          sourceSystem: 'FPTT',
          payments: [
            { _id: 'payment-123', dueDate: '2026-06-05', invoiceLines: [] }
          ]
        }
      ]
    }
    const paymentHubData = {
      sourceSystem: 'FPTT',
      frn: '12544567',
      sbi: '106284736'
    }
    createGrantPayment.mockResolvedValue(grantPayment)
    transformFpttPaymentDataToPaymentHubFormat.mockReturnValue(paymentHubData)

    await handleCreatePaymentEvent('msg-1', validPayload, logger)

    expect(transformFpttPaymentDataToPaymentHubFormat).toHaveBeenCalledWith(
      { sbi: '106284736', frn: '12544567', claimId: 'R00000004' },
      grantPayment.grants[0],
      grantPayment.grants[0].payments[0]
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Dry run: Payment payment-123 due date 2026-06-05 Payment Hub data: ${JSON.stringify(paymentHubData, null, 2)}`
    )
  })

  it('logs an error if createGrantPayment fails', async () => {
    const logger = { info: vi.fn(), error: vi.fn() }
    const error = new Error('Create failed')

    createGrantPayment.mockRejectedValue(error)

    await handleCreatePaymentEvent('msg-1', validPayload, logger)

    expect(logger.error).toHaveBeenCalledWith(
      error,
      'Error creating grant payment'
    )
  })
})
