import crypto from 'node:crypto'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
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
const createGrantPaymentPayload = (index, batchNum = 0) => {
  const timestamp = Date.now()
  const sbi = SBI_MIN + (index % SBI_MOD)
  const frn = FRN_MIN + (index % FRN_MOD)
  const claimId = `CLAIM-${timestamp}-${index}`
  const scheme = index % 2 === 0 ? 'SFI' : 'WMP'

  const totalAmount = getRandomAmount(AMOUNT_MIN, AMOUNT_MAX)

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + batchNum)

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
        dueDate: dueDate.toISOString().split('T')[0],
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
const processBatch = async (startIndex, batchSize, batchNum, logger) => {
  const promises = []
  const errors = []

  for (let i = startIndex; i < startIndex + batchSize; i++) {
    const payload = createGrantPaymentPayload(i, batchNum)

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
 * Controller to populate the database with grant payments for performance testing
 * @satisfies {Partial<ServerRoute>}
 */
const postTestPopulateGrantPaymentController = {
  handler: async (req, res) => {
    try {
      const { targetCount = 100, batchSize = 10 } = req.payload || {}
      const logger = req.logger

      logger.info(
        `Starting test database population: targetCount=${targetCount}, batchSize=${batchSize}`
      )

      const existingCount = await GrantPaymentsModel.countDocuments()
      logger.info(
        `Existing grant payments in database before creation: ${existingCount}`
      )

      let totalCreated = 0
      let totalErrors = 0
      const allErrors = []

      const totalBatches = Math.ceil(targetCount / batchSize)

      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const startIndex = batchNum * batchSize
        const currentBatchSize = Math.min(batchSize, targetCount - startIndex)

        logger.info(
          `Processing batch ${batchNum + 1}/${totalBatches} (startIndex: ${startIndex}, batchSize: ${currentBatchSize})`
        )

        const { successCount, errorCount, errors } = await processBatch(
          startIndex,
          currentBatchSize,
          batchNum,
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

      const finalCount = await GrantPaymentsModel.countDocuments()
      logger.info(
        `Total grant payments in database after creation: ${finalCount}`
      )

      return res
        .response({
          message: 'Population complete',
          totalCreated,
          totalErrors,
          errors: allErrors.slice(0, MAX_ERRORS_IN_RESPONSE) // Limit errors returned in response
        })
        .code(statusCodes.ok)
    } catch (error) {
      req.logger.error(error, `Error during test population`)
      return res
        .response({
          message: 'Failed to populate test data',
          error: serializeError(error)
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { postTestPopulateGrantPaymentController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
