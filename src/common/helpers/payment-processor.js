import { performance } from 'node:perf_hooks'
import { config } from '#~/config/index.js'
import { getTodaysDate, getNextDay } from '#~/common/helpers/date.js'
import {
  streamGrantPaymentsByDate,
  streamGrantPaymentsByCorrelationIds
} from '#~/common/helpers/fetch-grants-by-date.js'
import { sendPaymentHubRequest } from '#~/common/helpers/payment-hub/index.js'
import {
  updatePaymentStatus,
  markAllStaleLockedPaymentsAsFailed
} from '#~/common/helpers/update-payment-status.js'
import { transformDataToPaymentHubFormat } from '#~/common/helpers/payment-hub/transformers/index.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { grafanaLogMessages } from '#~/common/constants/grafana-log-messages.js'

const processSinglePayment = async (
  server,
  docId,
  grant,
  payment,
  identifiers,
  logger,
  backgroundTasks
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
    return { result: null, backgroundTask: null }
  }

  let paymentHubData
  try {
    paymentHubData = transformDataToPaymentHubFormat(
      identifiers,
      grant,
      payment
    )
  } catch (err) {
    logger.error(
      err,
      `${grafanaLogMessages.error.transformPaymentHubData} for payment ${payment._id} in record ${docId}`
    )
    await updatePaymentStatus(docId, payment._id, 'failed')
    return { result: serializeError(err), backgroundTask: null }
  }

  try {
    // Run in the background, with its own error handling to make processing faster
    const backgroundTask = sendPaymentHubRequest(server, paymentHubData)
      .then(async (res) => {
        await updatePaymentStatus(docId, payment._id, 'submitted')
        return res
      })
      .catch(async (err) => {
        logger.error(
          err,
          `${grafanaLogMessages.error.sendPaymentHubRequest} for record ${docId}`
        )
        await updatePaymentStatus(docId, payment._id, 'failed')
      })

    if (backgroundTasks) {
      backgroundTasks.push(backgroundTask)
    }

    return {
      result: {
        paymentId: payment._id,
        docId
      },
      backgroundTask
    }
  } catch (err) {
    logger.error(
      err,
      `${grafanaLogMessages.error.sendPaymentHubRequest} for record ${docId}`
    )
    await updatePaymentStatus(docId, payment._id, 'failed')
    return { result: serializeError(err), backgroundTask: null }
  }
}

const processAccountPayments = async (server, account, backgroundTasks) => {
  const { logger } = server
  const { _id: docId, sbi, frn, claimId, grants } = account
  const identifiers = { sbi, frn, claimId }

  const results = await Promise.all(
    (grants || []).flatMap((grant) =>
      (grant.matchedPayments || []).map((payment) =>
        processSinglePayment(
          server,
          docId,
          grant,
          payment,
          identifiers,
          logger,
          backgroundTasks
        )
      )
    )
  )

  return results.flatMap((r) => r.result)
}

export const processDailyPayments = async (
  server,
  limit,
  { date, correlationIds } = {}
) => {
  const { logger } = server

  if (date && correlationIds) {
    throw new Error(
      'Cannot provide both date and correlationIds. Provide one or the other.'
    )
  }

  const useDate = date || (!correlationIds && getTodaysDate())
  const useCorrelationIds = correlationIds || null

  let logMessage

  if (useCorrelationIds) {
    const logLimitedTo = limit ? ` (limited to ${limit} grants)` : ''
    logMessage = `Processing payments by correlation IDs: ${useCorrelationIds.length} grant(s)${logLimitedTo}`
    logger.info(logMessage)
  } else {
    const nextDay = getNextDay(useDate)
    const logLimitedTo = limit ? ` (limited to ${limit} payments)` : ''
    logMessage = `Processing payments for dates <= ${nextDay}${logLimitedTo}`
    logger.info(logMessage)
  }

  try {
    const fetchStart = performance.now()
    let cursor
    if (useCorrelationIds) {
      cursor = streamGrantPaymentsByCorrelationIds(
        useCorrelationIds,
        'pending',
        limit
      )
    } else {
      cursor = streamGrantPaymentsByDate(useDate, 'pending', limit)
    }
    const fetchDuration = (performance.now() - fetchStart).toFixed(2)

    const results = []
    const backgroundTasks = []
    const processStart = performance.now()
    await cursor.eachAsync(
      async (account) => {
        const accountResults = await processAccountPayments(
          server,
          account,
          backgroundTasks
        )
        results.push(...accountResults)
      },
      { parallel: config.get('paymentProcessor.maxBatchSize') }
    )
    const processDuration = (performance.now() - processStart).toFixed(2)

    const sendStart = performance.now()
    // Wait for all background payment hub requests to complete
    await Promise.all(backgroundTasks.filter(Boolean))
    const sendDuration = (performance.now() - sendStart).toFixed(2)

    return {
      results,
      backgroundTasks,
      fetchDuration,
      processDuration,
      sendDuration
    }
  } catch (err) {
    logger.error(err, `Failed to process payments while ${logMessage}`)
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
