import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { grafanaLogMessages } from '#~/common/constants/grafana-log-messages.js'
import { transformDataToPaymentHubFormat } from '#~/common/helpers/payment-hub/data-transformer.js'

/**
 * Inbound create_payment event handler
 *
 * @param {string} messageId
 * @param {any} payload
 * @param {import('pino').Logger} logger
 */
export async function handleCreatePaymentEvent(messageId, payload, logger) {
  try {
    const grantPayment = await createGrantPayment(payload.data)

    logger.info(
      `Successfully created grant payment entry for message ${messageId}: ${JSON.stringify(grantPayment)}`
    )

    const identifiers = {
      sbi: grantPayment.sbi,
      frn: grantPayment.frn,
      claimId: grantPayment.claimId
    }

    for (const grant of grantPayment.grants || []) {
      for (const payment of grant.payments || []) {
        const paymentHubData = transformDataToPaymentHubFormat(
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
    const mongoDuplicateKeyErrorCode = 11000
    const isDuplicateKeyError =
      err?.name === 'MongoServerError' &&
      err?.code === mongoDuplicateKeyErrorCode

    if (isDuplicateKeyError) {
      logger.warn(
        err,
        `Duplicate grant payment entry received for message ${messageId}: SBI: ${payload?.data?.sbi} FRN: ${payload?.data?.frn} correlation IDs: ${payload?.data?.grants
          ?.map?.((g) => [
            g.correlationId,
            ...(g.payments?.map?.((p) => p.correlationId) || [])
          ])
          .flat()
          .join(', ')}`
      )
    } else {
      logger.error(err, grafanaLogMessages.error.createPayment)
    }
  }
}
