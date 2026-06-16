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
    const logger = { info: vi.fn(), error: vi.fn() }
    const { sbi, frn } = sampleData.grants[0]

    cancelGrantPayments.mockResolvedValue({
      updatedPayments: [sampleData.grants[0]],
      foundGrantPayments: []
    })

    await handleCancelPaymentEvent('msg-1', validPayload, logger)

    expect(cancelGrantPayments).toHaveBeenCalledWith(sbi, frn)
    expect(logger.info).toHaveBeenCalledWith(
      {
        messageId: 'msg-1',
        eventType: validPayload.type,
        sbi
      },
      `Received cancel_payment event with payload ${JSON.stringify(validPayload, null, 2)}`
    )
    expect(logger.info).toHaveBeenCalledWith(
      { messageId: 'msg-1', sbi },
      `Successfully cancelled grant payment entry ${JSON.stringify([sampleData.grants[0]])}`
    )
  })

  it('logs a warning if no grant payment entry is found to cancel', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const { sbi, frn } = sampleData.grants[0]

    cancelGrantPayments.mockResolvedValue({
      updatedPayments: [],
      foundGrantPayments: []
    })

    await handleCancelPaymentEvent('msg-1', validPayload, logger)

    expect(cancelGrantPayments).toHaveBeenCalledWith(sbi, frn)
    expect(logger.warn).toHaveBeenCalledWith(
      `Warning: No grant payment entry found to cancel for sbi ${sbi} and frn ${frn}`
    )
  })

  it('logs an error if cancelGrantPayments fails', async () => {
    const logger = { info: vi.fn(), error: vi.fn() }
    const { sbi, frn } = sampleData.grants[0]

    const error = new Error('Database error')
    cancelGrantPayments.mockRejectedValue(error)

    await handleCancelPaymentEvent('msg-1', validPayload, logger)

    expect(cancelGrantPayments).toHaveBeenCalledWith(sbi, frn)
    expect(logger.error).toHaveBeenCalledWith(
      error,
      'Error cancelling grant payment'
    )
  })

  it('logs a warning if grant payments are found but none are in pending state to be cancelled', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const { sbi, frn } = sampleData.grants[0]

    cancelGrantPayments.mockResolvedValue({
      updatedPayments: [],
      foundGrantPayments: [sampleData.grants[0]]
    })

    await handleCancelPaymentEvent('msg-1', validPayload, logger)

    expect(cancelGrantPayments).toHaveBeenCalledWith(sbi, frn)
    expect(logger.warn).toHaveBeenCalledWith(
      { messageId: 'msg-1', sbi },
      `Found grant payment entries for sbi ${sbi} and frn ${frn}, but none were in a pending state to be cancelled`
    )
  })
})
