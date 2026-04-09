import crypto from 'node:crypto'
import Joi from 'joi'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

const SBI_MIN = 100000000
const SBI_MOD = 900000000
const FRN_MIN = 1000000000
const FRN_MOD = 9000000000
const PAYMENT_REQ_START = 1000000
const AMOUNT_MIN = 10000
const AMOUNT_MAX = 1000000
const MAX_ERRORS_IN_RESPONSE = 100
const AGREEMENT_NUMBER_PADDING = 9

/**
 * Generate a random amount in pence
 */
const getRandomAmount = (min, max) => {
  return crypto.randomInt(min, max + 1)
}

/**
 * Create a random grant payment payload
 */
const createGrantPaymentPayload = (index, dueDate) => {
  const timestamp = Date.now()
  const sbi = SBI_MIN + (index % SBI_MOD)
  const frn = FRN_MIN + (index % FRN_MOD)
  const claimId = `CLAIM-${timestamp}-${index}`
  const scheme = index % 2 === 0 ? 'SFI' : 'WMP'

  const totalAmount = getRandomAmount(AMOUNT_MIN, AMOUNT_MAX)

  const grant = {
    sourceSystem: 'SFI',
    paymentRequestNumber: PAYMENT_REQ_START + index,
    correlationId: `correlation-${timestamp}-${index}`,
    invoiceNumber: `INV-${timestamp}-${index}`,
    agreementNumber: `SFI${String(index).padStart(AGREEMENT_NUMBER_PADDING, '0')}`,
    totalAmountPence: totalAmount,
    currency: 'GBP',
    marketingYear: '2024',
    payments: [
      {
        dueDate,
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
const processBatch = async (startIndex, batchSize, dueDate, logger) => {
  const promises = []
  const errors = []

  for (let i = startIndex; i < startIndex + batchSize; i++) {
    const payload = createGrantPaymentPayload(i, dueDate)

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

async function populateDataInBatches(
  targetCount,
  calculatedBatchSize,
  logger,
  dueDate
) {
  let totalCreated = 0
  let totalErrors = 0
  const allErrors = []

  const totalBatches = Math.ceil(targetCount / calculatedBatchSize)

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const startIndex = batchNum * calculatedBatchSize
    const currentBatchSize = Math.min(
      calculatedBatchSize,
      targetCount - startIndex
    )

    logger.info(
      `Processing batch ${batchNum + 1}/${totalBatches} (startIndex: ${startIndex}, batchSize: ${currentBatchSize})`
    )

    const { successCount, errorCount, errors } = await processBatch(
      startIndex,
      currentBatchSize,
      dueDate,
      logger
    )
    totalCreated += successCount
    totalErrors += errorCount
    if (errors.length > 0) {
      allErrors.push(...errors)
    }
  }

  logger.info(
    `Population complete: ${totalCreated} created, ${totalErrors} errors`
  )
  return { totalCreated, totalErrors, allErrors }
}

/**
 * Controller to populate the database with grant payments for performance testing
 * @satisfies {Partial<ServerRoute>}
 */
const postTestPopulateGrantPaymentController = {
  options: {
    timeout: {
      server: false,
      socket: false
    },
    validate: {
      payload: Joi.object({
        targetCount: Joi.number().integer().min(1).default(100),
        dueDate: Joi.string()
          .isoDate()
          .default(() => new Date().toISOString().split('T')[0])
      }).default()
    }
  },
  handler: async (req, res) => {
    let { targetCount, dueDate } = req.payload

    // Ensure dueDate is only the date part YYYY-MM-DD
    if (dueDate?.includes('T')) {
      dueDate = dueDate.split('T')[0]
    }

    // Calculate batchSize based on targetCount
    // For small targetCount (< 100), use smaller batch size (e.g., 10)
    // For larger targetCount, use larger batch size (up to 100)
    const calculatedBatchSize = Math.max(
      10,
      Math.min(100, Math.ceil(targetCount / 10))
    )

    setImmediate(async () => {
      try {
        const logger = req.logger

        logger.info(
          `Starting test database population: targetCount=${targetCount}, batchSize=${calculatedBatchSize}, dueDate=${dueDate}`
        )

        const existingCount = await GrantPaymentsModel.countDocuments()
        logger.info(
          `Existing grant payments in database before creation: ${existingCount}`
        )

        const { totalCreated, totalErrors, allErrors } =
          await populateDataInBatches(
            targetCount,
            calculatedBatchSize,
            logger,
            dueDate
          )

        const finalCount = await GrantPaymentsModel.countDocuments()
        logger.info(
          `Total grant payments in database after creation: ${finalCount}`
        )

        logger.info({
          message: 'Population complete',
          totalCreated,
          totalErrors,
          errors: allErrors.slice(0, MAX_ERRORS_IN_RESPONSE) // Limit errors returned in response
        })
      } catch (error) {
        req.logger.error(error, `Error during test population`)
      }
    })

    return res
      .response({
        message: 'Grant payment population started',
        targetCount,
        batchSize: calculatedBatchSize,
        dueDate
      })
      .code(statusCodes.accepted)
  }
}

export { postTestPopulateGrantPaymentController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
