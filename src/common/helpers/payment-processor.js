import { getTodaysDate } from '#~/common/helpers/date.js'
import { fetchGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'
import { updatePaymentStatus } from '#~/common/helpers/update-payment-status.js'
import { transformFpttPaymentDataToPaymentHubFormat } from '#~/common/helpers/payment-hub/fptt-data-transformer.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { grafanaLogMessages } from '#~/common/constants/grafana-log-messages.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

const processSinglePayment = async (
  server,
  docId,
  grant,
  payment,
  identifiers,
  logger
) => {
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
    logger.info(`Skipping payment ${payment._id} (already locked or processed)`)
    return null
  }

  let paymentHubData
  if (grant.sourceSystem === 'FPTT') {
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
}

const processPayments = async (server, docs) => {
  const { logger } = server
  const actions = (docs || []).flatMap((doc) => {
    const { _id: docId, sbi, frn, claimId, grants } = doc

    return (grants || []).map(async (grantWithPendingPayments) => {
      const { payments } = grantWithPendingPayments
      const grant = (
        await GrantPaymentsModel.findOne(
          { _id: docId, 'grants._id': grantWithPendingPayments._id },
          { 'grants.$': 1 }
        )
      ).grants[0]

      const identifiers = { sbi, frn, claimId }
      return Promise.all(
        (payments || []).map((payment) =>
          processSinglePayment(
            server,
            docId,
            grant,
            payment,
            identifiers,
            logger
          )
        )
      )
    })
  })

  const results = await Promise.all(actions)
  return results.flat()
}

export const processDailyPayments = async (server, date = getTodaysDate()) => {
  const { logger } = server
  logger.info(`Processing daily payments for date: ${date}`)

  try {
    const { docs } = await fetchGrantPaymentsByDate(date, 'pending')
    logger.info(
      `Found ${docs.length} payment record(s) matching due date ${date}`
    )

    const results = await processPayments(server, docs)
    return results
  } catch (err) {
    logger.error(err, `Failed to process grant payments for date ${date}`)
    throw err
  }
}
