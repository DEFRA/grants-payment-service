import { getTodaysDate } from '#~/common/helpers/date.js'
import { fetchGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'

export const processDailyPayments = async (server, date = getTodaysDate()) => {
  const { logger } = server
  logger.info(`Processing daily payments for date: ${date}`)

  try {
    // fetch documents where any grant has a matching dueDate
    const docs = await fetchGrantPaymentsByDate(date)
    logger.info(
      `Found ${docs.length} payment record(s) matching due date ${date}`
    )

    // call payment hub for every document concurrently; collect results
    const results = await Promise.all(
      docs.map((doc) =>
        sendPaymentHubRequest(server, doc).catch((e) => {
          // log individual failures and return null so others continue
          logger.error(e, `PaymentHub request failed for record ${doc._id}`)
          return null
        })
      )
    )

    return results
  } catch (err) {
    logger.error(err, `Failed to query grant payments for date ${date}`)
    throw err
  }
}
