import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { prepareWithPaymentHubConfig } from '#~/common/helpers/payment-hub/prepare-with-payment-hub-config.js'
import { grafanaLogMessages } from '#~/common/constants/grafana-log-messages.js'

/**
 * Inbound create_payment event handler
 *
 * @param {string} messageId
 * @param {any} payload
 * @param {import('pino').Logger} logger
 */
export async function handleCreatePaymentEvent(messageId, payload, logger) {
  logger.info(
    { messageId, eventType: payload.type, sbi: payload?.data?.sbi },
    `Received create_payment payload is  ${JSON.stringify(payload, null, 2)}`
  )

  try {
    const grantPaymentWithPaymentHubConfig = prepareWithPaymentHubConfig(
      payload.data
    )

    const grantPayment = await createGrantPayment(
      grantPaymentWithPaymentHubConfig
    )

    logger.info(
      `Managed to successfully create grantPayment entry ${JSON.stringify(grantPayment)}`
    )
  } catch (err) {
    logger.error(err, grafanaLogMessages.error.createPayment)
  }
}
