import { describe, expect, it, vi } from 'vitest'

import { handleCreatePaymentEvent } from './handle-create-payment.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { prepareWithPaymentHubConfig } from '#~/common/helpers/payment-hub/prepare-with-payment-hub-config.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'

vi.mock('#~/common/helpers/create-grant-payment.js', () => {
  return {
    createGrantPayment: vi.fn()
  }
})

vi.mock(
  '#~/common/helpers/payment-hub/prepare-with-payment-hub-config.js',
  () => {
    return {
      prepareWithPaymentHubConfig: vi.fn()
    }
  }
)
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
    const mockPreparedData = { ...sampleData.grants[0], prepared: true }

    prepareWithPaymentHubConfig.mockReturnValue(mockPreparedData)
    createGrantPayment.mockResolvedValue(validPayload)

    await handleCreatePaymentEvent('msg-1', validPayload, logger)

    expect(prepareWithPaymentHubConfig).toHaveBeenCalledWith(
      sampleData.grants[0]
    )
    expect(createGrantPayment).toHaveBeenCalledWith(mockPreparedData)
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
})
