import { describe, expect, it, vi } from 'vitest'

import { handleCreatePaymentEvent } from './handle-create-payment.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'

vi.mock('#~/common/helpers/create-grant-payment.js', () => {
  return {
    createGrantPayment: vi.fn()
  }
})
const validEventPayload = {
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

    createGrantPayment.mockResolvedValue(validEventPayload)

    await handleCreatePaymentEvent('msg-1', validEventPayload, logger)

    expect(createGrantPayment).toHaveBeenCalledWith(validEventPayload.data)
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'msg-1',
        eventType:
          'cloud.defra.dev.farming-grants-agreements-api.payment.create',
        sbi: '106284736'
      }),
      'Received create_payment event'
    )
  })
})
