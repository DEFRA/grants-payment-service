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

const isStaleLocked = (payment, staleBefore) =>
  payment.status === 'locked' && payment.updatedAt < staleBefore

const toAffectedPayment = (doc, grant, payment) => ({
  sbi: doc.sbi,
  frn: doc.frn,
  claimId: doc.claimId,
  correlationId: payment.correlationId,
  invoiceNumber: grant.invoiceNumber,
  agreementNumber: grant.agreementNumber,
  dueDate: payment.dueDate,
  totalAmountPence: payment.totalAmountPence
})

const extractStalePaymentsFromGrant = (doc, grant, staleBefore) =>
  (grant.payments || [])
    .filter((payment) => isStaleLocked(payment, staleBefore))
    .map((payment) => toAffectedPayment(doc, grant, payment))

const extractStalePaymentsFromDocument = (doc, staleBefore) =>
  (doc.grants || []).flatMap((grant) =>
    extractStalePaymentsFromGrant(doc, grant, staleBefore)
  )

/**
 * Atomically find and mark ALL stale locked payments as failed using a transaction.
 * This ensures all updates happen atomically across multiple documents.
 * @returns {Promise<{ modifiedCount: number, affectedPayments: object[] }>} number of payments marked as failed, and the affected payments' identifiers (for audit purposes)
 */
export const markAllStaleLockedPaymentsAsFailed = async () => {
  const logger = getLogger()
  const session = await GrantPaymentsModel.startSession()

  try {
    let modifiedCount = 0
    let affectedPayments = []

    await session.withTransaction(
      async () => {
        const staleBefore = new Date(
          Date.now() - config.get('lockedPaymentTtl')
        )

        const staleFilter = {
          grants: {
            $elemMatch: {
              payments: {
                $elemMatch: {
                  status: 'locked',
                  updatedAt: { $lt: staleBefore }
                }
              }
            }
          }
        }

        // Capture identifiers of the payments about to be marked failed, for audit purposes
        const staleDocuments = await GrantPaymentsModel.find(
          staleFilter,
          null,
          {
            session
          }
        )
        affectedPayments = staleDocuments.flatMap((doc) =>
          extractStalePaymentsFromDocument(doc, staleBefore)
        )

        // Atomically update all documents with stale locked payments
        const result = await GrantPaymentsModel.updateMany(
          staleFilter,
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

        modifiedCount = result.modifiedCount
      },
      { readPreference: 'primary' }
    )

    return { modifiedCount, affectedPayments }
  } catch (err) {
    logger.error(err, `Error in stale locked payment cleanup: ${err.message}`)
    throw err
  } finally {
    await session.endSession()
  }
}
