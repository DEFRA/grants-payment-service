import { getTodaysDate } from '#~/common/helpers/date.js'
import { fetchGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'
import { updatePaymentStatus } from '#~/common/helpers/update-payment-status.js'
import { transformFpttPaymentDataToPaymentHubFormat } from './payment-hub/fptt-data-transformer'

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
    const actions = (docs || []).flatMap((doc) => {
      const { _id: docId, sbi, frn, claimId, grants } = doc

      return (grants || []).flatMap((grant) => {
        const { payments } = grant

        return (payments || []).map(async (payment) => {
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
          if (payment.sourceSystem === 'FPTT') {
            const identifiers = { sbi, frn, claimId }
            paymentHubData = transformFpttPaymentDataToPaymentHubFormat(
              identifiers,
              grant,
              payment
            )
          } else {
            logger.error(
              `Unsupported grant sourceSystem ${payment.sourceSystem} for payment ${payment._id}`
            )
            await updatePaymentStatus(docId, payment._id, 'failed')
            return null
          }

          try {
            const res = await sendPaymentHubRequest(server, paymentHubData)
            await updatePaymentStatus(docId, payment._id, 'submitted')
            return res
          } catch (e) {
            logger.error(e, `PaymentHub request failed for record ${docId}`)
            await updatePaymentStatus(docId, payment._id, 'failed')
            return null
          }
        })
      })
    })

    const results = await Promise.all(actions)
    return results
  } catch (err) {
    logger.error(err, `Failed to query grant payments for date ${date}`)
    throw err
  }
}
