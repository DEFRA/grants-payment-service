import { describe, expect, it, vi } from 'vitest'

import { handleCreatePaymentEvent } from './handle-create-payment.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { transformDataToPaymentHubFormat } from '#~/common/helpers/payment-hub/transformers/index.js'
import {
  auditEvent,
  AuditEvent
} from '#~/common/helpers/payment-hub/audit-event.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'

vi.mock('#~/common/helpers/create-grant-payment.js', () => {
  return {
    createGrantPayment: vi.fn()
  }
})

vi.mock('#~/common/helpers/payment-hub/transformers/index.js', () => {
  return {
    transformDataToPaymentHubFormat: vi.fn()
  }
})

vi.mock('#~/common/helpers/payment-hub/audit-event.js', async () => {
  const actual = await vi.importActual(
    '#~/common/helpers/payment-hub/audit-event.js'
  )
  return {
    ...actual,
    auditEvent: vi.fn()
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

const sbi = '800000001'
const frn = `0${sbi}`
const claimId = 'R00000004'

describe('handleCreatePaymentEvent', () => {
  it('logs receipt of a create_payment message', async () => {
    const logger = { info: vi.fn() }
    createGrantPayment.mockResolvedValue(validPayload)

    await handleCreatePaymentEvent('msg-1', validPayload, logger)

    expect(createGrantPayment).toHaveBeenCalledWith(sampleData.grants[0])
    expect(logger.info).toHaveBeenCalledWith(
      `Successfully created grant payment entry for message msg-1: ${JSON.stringify(validPayload)}`
    )
  })

  it('logs dry-run payment hub data for each payment', async () => {
    const logger = { info: vi.fn() }
    const grantPayment = {
      sbi,
      frn,
      claimId,
      grants: [
        {
          sourceSystem: 'FPTT',
          invoiceNumber: 'INV-001',
          agreementNumber: 'AGR-001',
          payments: [
            {
              _id: 'payment-123',
              correlationId: 'payment-correlation-id',
              dueDate: '2026-06-05',
              invoiceLines: []
            }
          ]
        }
      ]
    }
    const paymentHubData = {
      sourceSystem: 'FPTT',
      frn,
      sbi
    }
    createGrantPayment.mockResolvedValue(grantPayment)
    transformDataToPaymentHubFormat.mockReturnValue(paymentHubData)

    await handleCreatePaymentEvent('msg-1', validPayload, logger)

    expect(transformDataToPaymentHubFormat).toHaveBeenCalledWith(
      { sbi, frn, claimId },
      grantPayment.grants[0],
      grantPayment.grants[0].payments[0]
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Dry run: Payment payment-123 due date 2026-06-05 Payment Hub data: ${JSON.stringify(paymentHubData, null, 2)}`
    )
    expect(auditEvent).toHaveBeenCalledWith(AuditEvent.GRANT_PAYMENT_CREATED, {
      correlationId: 'payment-correlation-id',
      contractNumber: 'AGR-001',
      invoiceNumber: 'INV-001',
      agreementNumber: 'AGR-001',
      sbi,
      frn,
      identifiers: { sbi, frn, crn: claimId }
    })
  })

  it('handles grant payment with no grants array', async () => {
    const logger = { info: vi.fn() }
    const grantPayment = {
      sbi,
      frn,
      claimId,
      grants: null
    }
    createGrantPayment.mockResolvedValue(grantPayment)

    await handleCreatePaymentEvent('msg-1', validPayload, logger)

    expect(transformDataToPaymentHubFormat).not.toHaveBeenCalled()
    expect(auditEvent).not.toHaveBeenCalled()
  })

  it('handles grants with no payments array', async () => {
    const logger = { info: vi.fn() }
    const grantPayment = {
      sbi,
      frn,
      claimId,
      grants: [{ sourceSystem: 'FPTT', payments: null }]
    }
    createGrantPayment.mockResolvedValue(grantPayment)

    await handleCreatePaymentEvent('msg-1', validPayload, logger)

    expect(transformDataToPaymentHubFormat).not.toHaveBeenCalled()
    expect(auditEvent).not.toHaveBeenCalled()
  })

  it('logs an error if createGrantPayment fails', async () => {
    const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
    const error = new Error('Create failed')

    createGrantPayment.mockRejectedValue(error)

    await handleCreatePaymentEvent('msg-1', validPayload, logger)

    expect(logger.error).toHaveBeenCalledWith(
      error,
      'Error creating grant payment'
    )
    expect(logger.warn).not.toHaveBeenCalled()
    expect(auditEvent).not.toHaveBeenCalled()
  })
})
