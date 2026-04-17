import { performance } from 'node:perf_hooks'
import { config } from '#~/config/index.js'
import { getTodaysDate } from '#~/common/helpers/date.js'
import { streamGrantPaymentsByDate } from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'
import {
  updatePaymentStatus,
  markAllStaleLockedPaymentsAsFailed
} from '#~/common/helpers/update-payment-status.js'
import { transformFpttPaymentDataToPaymentHubFormat } from '#~/common/helpers/payment-hub/fptt-data-transformer.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { grafanaLogMessages } from '#~/common/constants/grafana-log-messages.js'

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

const processAccountPayments = async (server, account) => {
  const { logger } = server
  const { _id: docId, sbi, frn, claimId, grants } = account
  const identifiers = { sbi, frn, claimId }

  const results = await Promise.all(
    (grants || []).flatMap((grant) =>
      (grant.matchedPayments || []).map((payment) =>
        processSinglePayment(server, docId, grant, payment, identifiers, logger)
      )
    )
  )

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
    const cursor = streamGrantPaymentsByDate(date, 'pending', limit)
    const fetchDuration = (performance.now() - fetchStart).toFixed(2)

    const results = []
    const processStart = performance.now()

    await cursor.eachAsync(
      async (account) => {
        const accountResults = await processAccountPayments(server, account)
        results.push(...accountResults)
      },
      { parallel: config.get('paymentProcessor.maxBatchSize') }
    )

    const processDuration = (performance.now() - processStart).toFixed(2)

    if (results.length === 0) {
      return { results: [], fetchDuration, processDuration: '0.00' }
    }

    return { results, fetchDuration, processDuration }
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
