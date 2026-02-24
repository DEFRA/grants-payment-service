import { getTodaysDate } from '#~/common/helpers/date.js'
import { fetchGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'
import { updatePaymentStatus } from '#~/common/helpers/update-payment-status.js'

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
    const extractPaymentItems = (doc) => {
      const items = []
      for (const grant of doc.grants || []) {
        for (const payment of grant.payments || []) {
          items.push({ docId: doc._id, payment })
        }
      }
      return items
    }

    const paymentItems = docs.flatMap(extractPaymentItems)

    // helper performs the lock + send sequence for a single payment
    const handlePayment = async ({ docId, payment }) => {
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

      try {
        const res = await sendPaymentHubRequest(server, payment)
        await updatePaymentStatus(docId, payment._id, 'submitted')
        return res
      } catch (e) {
        logger.error(e, `PaymentHub request failed for record ${docId}`)
        await updatePaymentStatus(docId, payment._id, 'failed')
        return null
      }
    }

    const actions = paymentItems.map(handlePayment)
    const results = await Promise.all(actions)

    return results
  } catch (err) {
    logger.error(err, `Failed to query grant payments for date ${date}`)
    throw err
  }
}
