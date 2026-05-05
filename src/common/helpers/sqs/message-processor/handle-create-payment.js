import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { grafanaLogMessages } from '#~/common/constants/grafana-log-messages.js'
import { transformFpttPaymentDataToPaymentHubFormat } from '#~/common/helpers/payment-hub/fptt-data-transformer.js'

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
    const grantPayment = await createGrantPayment(payload.data)

    logger.info(
      `Managed to successfully create grantPayment entry ${JSON.stringify(grantPayment)}`
    )

    const identifiers = {
      sbi: grantPayment.sbi,
      frn: grantPayment.frn,
      claimId: grantPayment.claimId
    }

    for (const grant of grantPayment.grants || []) {
      for (const payment of grant.payments || []) {
        const paymentHubData = transformFpttPaymentDataToPaymentHubFormat(
          identifiers,
          grant,
          payment
        )
        logger.info(
          `Dry run: Payment ${payment._id} due date ${payment.dueDate} Payment Hub data: ${JSON.stringify(paymentHubData, null, 2)}`
        )
      }
    }
  } catch (err) {
    logger.error(err, grafanaLogMessages.error.createPayment)
  }
}
