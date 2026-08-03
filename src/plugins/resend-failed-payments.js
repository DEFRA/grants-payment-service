import mongoose from 'mongoose'
import GrantPayments from '#~/api/common/models/grant_payments.js'
import { config } from '#~/config/index.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'
import { getStats } from '#~/common/helpers/get-stats.js'
import {
  auditEvent,
  AuditEvent
} from '#~/common/helpers/payment-hub/audit-event.js'

const pluginName = 'resend-failed-payments'

const toAffectedPayment = (doc, grant, payment) => ({
  sbi: doc.sbi,
  frn: doc.frn,
  claimId: doc.claimId,
  correlationId: payment.correlationId,
  invoiceNumber: grant.invoiceNumber,
  agreementNumber: grant.agreementNumber,
  dueDate: payment.dueDate,
  totalAmountPence: payment.totalAmountPence
})

const extractFailedPaymentsFromGrant = (doc, grant) =>
  (grant.payments || [])
    .filter((payment) => payment.status === 'failed')
    .map((payment) => toAffectedPayment(doc, grant, payment))

const extractFailedPaymentsFromDocument = (doc) =>
  (doc.grants || []).flatMap((grant) =>
    extractFailedPaymentsFromGrant(doc, grant)
  )

const updateFailedPaymentsToPending = async (server) => {
  const failedFilter = {
    grants: {
      $elemMatch: {
        payments: {
          $elemMatch: {
            status: 'failed'
          }
        }
      }
    }
  }

  // Capture identifiers of the payments about to be reset, for audit purposes
  const failedDocuments = await GrantPayments.find(failedFilter).lean()
  const affectedPayments = failedDocuments.flatMap((doc) =>
    extractFailedPaymentsFromDocument(doc)
  )

  const result = await GrantPayments.updateMany(
    failedFilter,
    {
      $set: {
        'grants.$[].payments.$[p].status': 'pending',
        'grants.$[].payments.$[p].updatedAt': new Date()
      }
    },
    {
      arrayFilters: [
        {
          'p.status': 'failed'
        }
      ]
    }
  )

  server.logger.info(
    `${pluginName}: updated ${result.modifiedCount} failed payment(s) to pending`
  )

  return { modifiedCount: result.modifiedCount, affectedPayments }
}

const runResendFailedPayments = async (server) => {
  const { modifiedCount: updatedCount, affectedPayments } =
    await updateFailedPaymentsToPending(server)

  if (updatedCount > 0) {
    for (const payment of affectedPayments) {
      await auditEvent(AuditEvent.GRANT_PAYMENTS_RESET_TO_PENDING, {
        correlationId: payment.correlationId,
        invoiceNumber: payment.invoiceNumber,
        agreementNumber: payment.agreementNumber,
        sbi: payment.sbi,
        frn: payment.frn,
        identifiers: {
          sbi: payment.sbi,
          frn: payment.frn,
          crn: payment.claimId
        }
      })
    }

    server.logger.info(
      `${pluginName}: triggering processDailyPayments to process updated payments`
    )
    await processDailyPayments(server)

    const stats = await getStats()
    server.logger.info(
      `${pluginName}: Stats: ${JSON.stringify(stats, null, 2)}`
    )
  } else {
    server.logger.info(`${pluginName}: no failed payments found to resend`)
  }
}

const resendFailedPayments = {
  plugin: {
    name: pluginName,
    register: async (server) => {
      if (config.get('featureFlags.resendFailedPaymentsEnabled') !== true) {
        return
      }

      server.logger.info(`${pluginName}: Registering plugin`)

      const execute = async () => {
        try {
          await runResendFailedPayments(server)
        } catch (error) {
          server.logger.error(
            error,
            `${pluginName}: resend failed payments failed`
          )
        }
      }

      if (mongoose.connection?.readyState === 1) {
        await execute()
      } else {
        mongoose.connection.once('connected', async () => {
          await execute()
        })
      }
    }
  }
}

export { resendFailedPayments }
