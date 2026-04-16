import { performance } from 'node:perf_hooks'
import { getTodaysDate } from '#~/common/helpers/date.js'
import { fetchGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'
import {
  updatePaymentStatus,
  markAllStaleLockedPaymentsAsFailed
} from '#~/common/helpers/update-payment-status.js'
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
  const wasLocked = !!lockResult

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

const processPayments = async (server, accounts) => {
  const { logger } = server

  const paymentActions = (accounts || []).flatMap((account) => {
    const { _id: docId, sbi, frn, claimId, grants } = account
    const identifiers = { sbi, frn, claimId }

    return (grants || []).map(async (grantWithPendingPayments) => {
      const grant = (
        await GrantPaymentsModel.findOne(
          { _id: docId, 'grants._id': grantWithPendingPayments._id },
          { 'grants.$': 1 }
        )
      ).grants[0]

      return Promise.all(
        (grantWithPendingPayments.payments || []).map((payment) =>
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

  const results = await Promise.all(paymentActions)
  return results.flat()
}

export const processDailyPayments = async (
  server,
  limit,
  date = getTodaysDate()
) => {
  const { logger } = server
  const logLimitedTo = limit ? ` (limited to ${limit} payments)` : ''
  logger.info(`Processing payments for date: ${date}${logLimitedTo}`)

  try {
    const fetchStart = performance.now()
    const { docs: accounts, totalDocs: totalAccounts } =
      await fetchGrantPaymentsByDate(date, 'pending', limit)
    const fetchDuration = (performance.now() - fetchStart).toFixed(2)
    logger.info(
      `Found ${totalAccounts} payment record(s) matching due date ${date}${logLimitedTo} in ${fetchDuration}ms`
    )

    const results = await processPayments(server, accounts)
    const processDuration = (performance.now() - fetchStart).toFixed(2)
    logger.info(
      `Processed ${results.length} payment(s) for date: ${date}${logLimitedTo} in ${processDuration}ms`
    )
    return results
  } catch (err) {
    logger.error(
      err,
      `Failed to process payments for date ${date}${logLimitedTo}`
    )
    throw err
  }
}

export const processStaleLockedPayments = async (server) => {
  const { logger } = server
  logger.info('Processing stale locked payments')

  try {
    const staleLockedPayments = await markAllStaleLockedPaymentsAsFailed()
    if (staleLockedPayments > 0) {
      logger.error(
        `${grafanaLogMessages.error.staleLockPaymentTimeout}: marked ${staleLockedPayments} stale locked payment(s) as failed`
      )
    } else {
      logger.info('No stale locked payments found')
    }
    return staleLockedPayments
  } catch (err) {
    logger.error(err, 'Failed to process stale locked payments')
    throw err
  }
}
