import { getTodaysDate } from '#~/common/helpers/date.js'
import { fetchGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'
import { updatePaymentStatus } from '#~/common/helpers/update-payment-status.js'
import { transformFpttPaymentDataToPaymentHubFormat } from '#~/common/helpers/payment-hub/fptt-data-transformer.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { grafanaLogMessages } from '#~/common/constants/grafana-log-messages.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const processDailyPayments = async (server, date = getTodaysDate()) => {
  const { logger } = server
  logger.info(`Processing daily payments for date: ${date}`)

  try {
    // fetch documents where any grant has a matching dueDate
    const docs = await fetchGrantPaymentsByDate(date, 'pending')
    logger.info(
      `Found ${docs.length} payment record(s) matching due date ${date}`
    )

    // flatten document/grant/payment hierarchy into a simple list of payment items
    const actions = []
    for (const doc of docs || []) {
      const { _id: docId, sbi, frn, claimId, grants } = doc

      for (const grantWithPendingPayments of grants || []) {
        const { payments } = grantWithPendingPayments
        const grant = (
          await GrantPaymentsModel.findOne(
            { _id: docId, 'grants._id': grantWithPendingPayments._id },
            { 'grants.$': 1 }
          )
        ).grants[0]

        for (const payment of payments || []) {
          actions.push(
            (async () => {
              // attempt to lock the payment; only succeed if it is still pending.
              const lockResult = await updatePaymentStatus(
                docId,
                payment._id,
                'locked',
                'pending'
              )

              const wasLocked =
                lockResult &&
                (lockResult.nModified === 1 ||
                  lockResult.modifiedCount === 1 ||
                  lockResult.n === 1)

              if (!wasLocked) {
                logger.info(
                  `Skipping payment ${payment._id} (already locked or processed)`
                )
                return null
              }

              let paymentHubData
              if (grant.sourceSystem === 'FPTT') {
                const identifiers = { sbi, frn, claimId }
                paymentHubData = transformFpttPaymentDataToPaymentHubFormat(
                  identifiers,
                  grant,
                  payment
                )
              } else {
                logger.error(
                  `Unsupported grant sourceSystem ${grant.sourceSystem} for payment ${payment._id}`
                )
                await updatePaymentStatus(docId, payment._id, 'failed')
                return null
              }

              try {
                const res = await sendPaymentHubRequest(server, paymentHubData)
                await updatePaymentStatus(docId, payment._id, 'submitted')
                return res
              } catch (err) {
                logger.error(
                  err,
                  `${grafanaLogMessages.error.sendPaymentHubRequest} for record ${docId}`
                )
                await updatePaymentStatus(docId, payment._id, 'failed')
                return serializeError(err)
              }
            })()
          )
        }
      }
    }

    const results = await Promise.all(actions)
    return results
  } catch (err) {
    logger.error(err, `Failed to process grant payments for date ${date}`)
    throw err
  }
}
