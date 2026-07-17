import { cancelGrantPayments } from '#~/common/helpers/cancel-grant-payment.js'
import { grafanaLogMessages } from '#~/common/constants/grafana-log-messages.js'
import {
  auditEvent,
  AuditEvent
} from '#~/common/helpers/payment-hub/audit-event.js'

/**
 * Builds the auditEvent context for each cancelled payment across all updated documents.
 * @param {Array<{ grantPayment: object, cancelledPayments: object[] }>} updatedPayments
 * @returns {object[]}
 */
const buildCancelledPaymentAuditContexts = (updatedPayments) =>
  updatedPayments.flatMap(({ grantPayment, cancelledPayments }) =>
    cancelledPayments.map((payment) => ({
      correlationId: payment.correlationId,
      invoiceNumber: payment.invoiceNumber,
      agreementNumber: payment.agreementNumber,
      sbi: grantPayment.sbi,
      frn: grantPayment.frn,
      identifiers: {
        sbi: grantPayment.sbi,
        frn: grantPayment.frn,
        crn: grantPayment.claimId
      }
    }))
  )

/**
 * Inbound cancel_payment event handler
 *
 * @param {string} messageId
 * @param {any} payload
 * @param {import('pino').Logger} logger
 */
export async function handleCancelPaymentEvent(messageId, payload, logger) {
  const { sbi, frn } = payload.data

  try {
    const { updatedPayments, foundGrantPayments } = await cancelGrantPayments(
      sbi,
      frn
    )

    if (updatedPayments.length) {
      logger.info(
        { messageId, sbi },
        `Successfully cancelled grant payment entry for message ${messageId}: ${JSON.stringify(updatedPayments)}`
      )

      const auditContexts = buildCancelledPaymentAuditContexts(updatedPayments)
      for (const auditContext of auditContexts) {
        await auditEvent(AuditEvent.GRANT_PAYMENT_CANCELLED, auditContext)
      }
    } else if (foundGrantPayments.length) {
      logger.warn(
        { messageId, sbi },
        `Found grant payment entries for message ${messageId}: sbi ${sbi} and frn ${frn}, but none were in a pending state to be cancelled`
      )
    } else {
      logger.warn(
        `${grafanaLogMessages.warning.noGrantPaymentEntryFound} to cancel for message ${messageId}: sbi ${sbi} and frn ${frn}`
      )
    }
  } catch (err) {
    logger.error(err, grafanaLogMessages.error.cancelPayment)
  }
}
