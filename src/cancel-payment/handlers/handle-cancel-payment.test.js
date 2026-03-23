import { describe, expect, it, vi } from 'vitest'

import { handleCancelPaymentEvent } from './handle-cancel-payment.js'
import { cancelGrantPayments } from '#~/common/helpers/cancel-grant-payment.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'

vi.mock('#~/common/helpers/cancel-grant-payment.js', () => {
  return {
    cancelGrantPayments: vi.fn()
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
  type: 'cloud.defra.dev.farming-grants-agreements-api.payment.cancel',
  datacontenttype: 'application/json',
  data: sampleData.grants[0]
}

describe('handleCancelPaymentEvent', () => {
  it('logs receipt of a cancel_payment message', async () => {
    const logger = { info: vi.fn() }
    const { sbi, frn } = sampleData.grants[0]

    cancelGrantPayments.mockResolvedValue([sampleData.grants[0]])

    await handleCancelPaymentEvent('msg-1', validPayload, logger)

    expect(cancelGrantPayments).toHaveBeenCalledWith(sbi, frn)
    expect(logger.info).toHaveBeenCalledWith(
      {
        messageId: 'msg-1',
        eventType: validPayload.type,
        sbi: sbi
      },
      `Received cancel_payment event with payload is  ${JSON.stringify(validPayload, null, 2)}`
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Managed to successfully cancel grantPayment entry ${JSON.stringify([sampleData.grants[0]])}`
    )
  })
})
