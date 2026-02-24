import GrantPaymentsModel from '#~/api/common/grant_payments.js'
import { getLogger } from '#~/common/helpers/logging/logger.js'

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

    const result = await GrantPaymentsModel.updateOne(
      { _id: documentId },
      { $set: { 'grants.$[].payments.$[p].status': status } },
      { arrayFilters: [arrayFilter] }
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
