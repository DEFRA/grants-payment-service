/**
 * Script to populate the database with grant payments for performance testing
 *
 * Usage: node scripts/populate-grant-payments.js [targetCount] [batchSize]
 * Example: node scripts/populate-grant-payments.js 100 10
 */

import mongoose from 'mongoose'
import { config } from '#~/config/index.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import pino from 'pino'

const logger = pino({
  level: config.get('log.level'),
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
})

// Parse command line arguments with defaults
const TARGET_COUNT = parseInt(process.argv[2], 10) || 100
const BATCH_SIZE = parseInt(process.argv[3], 10) || 10

// MongoDB connection settings
const MONGO_URI = config.get('mongo.uri')
const MONGO_DB = config.get('mongo.database')

/**
 * Generate a random number string of fixed length
 */
// function generateRandomNumberString(length) {
//   let result = ''
//   for (let i = 0; i < length; i++) {
//     result += Math.floor(Math.random() * 10).toString()
//   }
//   return result
// }

/**
 * Generate a random amount in pence
 */
function getRandomAmount(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

/**
 * Create a random grant payment payload
 */
function createGrantPaymentPayload(index) {
  const timestamp = Date.now()
  const sbi = 100000000 + (index % 900000000)
  const frn = 1000000000 + (index % 9000000000)
  const claimId = `CLAIM-${timestamp}-${index}`
  const scheme = index % 2 === 0 ? 'SFI' : 'WMP'

  const totalAmount = getRandomAmount(10000, 1000000)

  const grant = {
    sourceSystem: 'SFI',
    paymentRequestNumber: 1000000 + index,
    correlationId: `correlation-${timestamp}-${index}`,
    invoiceNumber: `INV-${timestamp}-${index}`,
    agreementNumber: `SFI${String(index).padStart(9, '0')}`,
    totalAmountPence: totalAmount,
    currency: 'GBP',
    marketingYear: '2024',
    payments: [
      {
        dueDate: new Date().toISOString().split('T')[0],
        totalAmountPence: totalAmount,
        invoiceLines: [
          {
            schemeCode: scheme,
            description: `Payment for ${scheme} claim`,
            amountPence: totalAmount
          }
        ]
      }
    ]
  }

  return {
    sbi: String(sbi),
    frn: String(frn),
    claimId,
    scheme, // Used by prepareWithPaymentHubConfig
    grants: [grant]
  }
}

/**
 * Process a batch of grant payments
 */
async function processBatch(startIndex, batchSize) {
  const promises = []
  const errors = []

  for (let i = startIndex; i < startIndex + batchSize; i++) {
    const payload = createGrantPaymentPayload(i)

    promises.push(
      createGrantPayment(payload).catch((err) => {
        errors.push({
          index: i,
          claimId: payload.claimId,
          error: err.message
        })
        logger.error(
          { err, claimId: payload.claimId },
          `Error creating grant payment for claim ${payload.claimId}`
        )
        return null
      })
    )
  }

  const results = await Promise.all(promises)
  const successCount = results.filter((r) => r !== null).length

  return { successCount, errorCount: errors.length, errors }
}

/**
 * Format time in human-readable format
 */
function formatTime(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}m ${secs}s`
}

/**
 * Estimate time remaining
 */
function estimateTimeRemaining(elapsed, completed, total) {
  if (completed === 0) return 'calculating...'
  const rate = completed / elapsed
  const remaining = (total - completed) / rate
  return formatTime(remaining)
}

/**
 * Main execution function
 */
async function main() {
  logger.info('Starting database population for grant payments...')
  logger.info(`Target: ${TARGET_COUNT.toLocaleString()} grant payments`)
  logger.info(`Batch size: ${BATCH_SIZE}`)
  logger.info(`Database: ${MONGO_DB}`)
  logger.info('')

  // Validate inputs
  if (TARGET_COUNT <= 0 || BATCH_SIZE <= 0) {
    throw new Error('TARGET_COUNT and BATCH_SIZE must be positive numbers')
  }

  const startTime = Date.now()
  let totalCreated = 0
  let totalErrors = 0

  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...')
    await mongoose.connect(`${MONGO_URI}${MONGO_DB}`, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    })
    logger.info('Connected to MongoDB')
    logger.info('')

    // Check existing count
    const existingCount = await GrantPaymentsModel.countDocuments()
    logger.info(
      `Existing grant payments in database: ${existingCount.toLocaleString()}`
    )

    // Process in batches
    const totalBatches = Math.ceil(TARGET_COUNT / BATCH_SIZE)
    logger.info(`Processing ${totalBatches} batches...`)
    logger.info('')

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const startIndex = batchNum * BATCH_SIZE
      const currentBatchSize = Math.min(BATCH_SIZE, TARGET_COUNT - startIndex)

      const { successCount, errorCount } = await processBatch(
        startIndex,
        currentBatchSize
      )
      totalCreated += successCount
      totalErrors += errorCount

      const percentComplete = (((batchNum + 1) / totalBatches) * 100).toFixed(1)
      const elapsed = (Date.now() - startTime) / 1000
      const rate = (totalCreated / elapsed).toFixed(0)
      const eta = estimateTimeRemaining(elapsed, totalCreated, TARGET_COUNT)

      // Progress update
      process.stdout.write(
        `\rProgress: ${totalCreated.toLocaleString()}/${TARGET_COUNT.toLocaleString()} ` +
          `(${percentComplete}%) | ` +
          `${rate} payments/sec | ` +
          `ETA: ${eta} | ` +
          `Errors: ${totalErrors}`
      )

      if ((batchNum + 1) % 10 === 0) {
        process.stdout.write('\n')
      }
    }

    process.stdout.write('\n\n')

    // Final statistics
    const endTime = Date.now()
    const totalTime = (endTime - startTime) / 1000
    const avgRate = (totalCreated / totalTime).toFixed(0)
    const successRate = ((totalCreated / TARGET_COUNT) * 100).toFixed(2)

    logger.info('Population complete!')
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info(
      `Total grant payments created: ${totalCreated.toLocaleString()}`
    )
    logger.info(`Total errors: ${totalErrors.toLocaleString()}`)
    logger.info(`Success rate: ${successRate}%`)
    logger.info(`Total time: ${formatTime(totalTime)}`)
    logger.info(`Average rate: ${avgRate} payments/sec`)

    const finalCount = await GrantPaymentsModel.countDocuments()
    logger.info(`Final database count: ${finalCount.toLocaleString()}`)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    process.exitCode = totalErrors > 0 ? 1 : 0
  } catch (error) {
    logger.error({ err: error }, 'Error during population')
    throw error
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect()
    logger.info('Disconnected from MongoDB')
  }
}

// Execute the script
main().catch((error) => {
  logger.error({ err: error }, 'Fatal error')
  process.exitCode = 1
})
