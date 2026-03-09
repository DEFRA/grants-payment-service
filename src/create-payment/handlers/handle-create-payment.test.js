import { describe, expect, it, vi } from 'vitest'

import { handleCreatePaymentEvent } from './handle-create-payment.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'

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
  data: sampleData.grants[0]
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
