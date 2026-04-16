import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { getLogger } from '#~/common/helpers/logging/logger.js'
import { config } from '#~/config/index.js'

/**
 * Change the status of a single payment subdocument.
 *
 * @param {string} documentId - _id of the grant payments document
 * @param {string} paymentId - _id of the specific payment subdocument
 * @param {string} status - new status value (locked, submitted, failed, etc.)
 * @param {string} currentStatus - Optional previous status to assert when performing the update. If provided, the update will only succeed when the existing payment status equals this value. This is useful for acquiring a lock (e.g. pending -> locked) in a concurrent environment.
 * @returns {Promise<object>} result of the update operation
 */
export const updatePaymentStatus = async (
  documentId,
  paymentId,
  status,
  currentStatus
) => {
  const logger = getLogger()

  try {
    // build the array filter; always match by _id and optionally current status
    const arrayFilter = { 'p._id': paymentId }
    if (currentStatus !== undefined) {
      arrayFilter['p.status'] = currentStatus
    }

    const result = await GrantPaymentsModel.findOneAndUpdate(
      { _id: documentId },
      { $set: { 'grants.$[].payments.$[p].status': status } },
      { arrayFilters: [arrayFilter], returnDocument: 'after' }
    )

    logger.info(
      `Updated payment ${paymentId} (doc ${documentId}) status to ${status}`
    )
    return result
  } catch (err) {
    logger.error(
      err,
      `Failed to update status to ${status} for payment ${paymentId} in ${documentId}`
    )
    throw err
  }
}

/**
 * Atomically find and mark ALL stale locked payments as failed using a transaction.
 * This ensures all updates happen atomically across multiple documents.
 * @returns {Promise<number>} number of payments marked as failed
 */
export const markAllStaleLockedPaymentsAsFailed = async () => {
  const logger = getLogger()
  const session = await GrantPaymentsModel.startSession()

  try {
    let markedCount = 0

    await session.withTransaction(
      async () => {
        const staleBefore = new Date(
          Date.now() - config.get('lockedPaymentTtl')
        )

        // Find all documents with stale locked payments
        const staleDocs = await GrantPaymentsModel.find(
          {
            'grants.payments.status': 'locked',
            'grants.payments.updatedAt': { $lt: staleBefore }
          },
          null,
          { session }
        )

        // Update each document atomically within the transaction
        for (const doc of staleDocs) {
          await GrantPaymentsModel.updateOne(
            { _id: doc._id },
            {
              $set: {
                'grants.$[].payments.$[p].status': 'failed',
                'grants.$[].payments.$[p].updatedAt': new Date()
              }
            },
            {
              session,
              arrayFilters: [
                {
                  'p.status': 'locked',
                  'p.updatedAt': { $lt: staleBefore }
                }
              ]
            }
          )
          markedCount++
        }
      },
      { readPreference: 'primary' }
    )

    return markedCount
  } catch (err) {
    logger.error(err, `Error in stale locked payment cleanup: ${err.message}`)
    throw err
  } finally {
    await session.endSession()
  }
}
