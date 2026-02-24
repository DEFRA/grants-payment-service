import { describe, expect, it, vi } from 'vitest'

import { handleCreatePaymentEvent } from './handle-create-payment.js'

describe('handleCreatePaymentEvent', () => {
  it('logs receipt of a create_payment message', async () => {
    const logger = { info: vi.fn() }

    await handleCreatePaymentEvent(
      'msg-1',
      { type: 'create_payment', agreementId: 'AGREEMENT123' },
      logger
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'msg-1',
        eventType: 'create_payment',
        agreementId: 'AGREEMENT123'
      }),
      'Received create_payment message'
    )
  })
})
