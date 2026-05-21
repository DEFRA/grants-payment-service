import { randomUUID } from 'node:crypto'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { prepareWithPaymentHubConfig } from '#~/common/helpers/payment-hub/prepare-with-payment-hub-config.js'

const extractGrantCorrelationIds = (grantPayment) =>
  (grantPayment.grants || [])
    .map((grant) => grant.correlationId)
    .filter(Boolean)

const addCorrelationId = (grantPayment) => ({
  ...grantPayment,
  grants: (grantPayment.grants || []).map((grant) => ({
    ...grant,
    correlationId: grant.correlationId || randomUUID(),
    payments: (grant.payments || []).map((payment) => ({
      ...payment,
      correlationId: payment.correlationId || randomUUID()
    }))
  }))
})

const DUPLICATE_KEY_ERROR_CODE = 11000

export const createGrantPayment = async (payload) => {
  const preparedPayload = addCorrelationId(prepareWithPaymentHubConfig(payload))
  const grantCorrelationIds = extractGrantCorrelationIds(preparedPayload)

  let existing = null
  if (grantCorrelationIds.length > 0) {
    existing = await GrantPaymentsModel.findOne({
      'grants.correlationId': { $in: grantCorrelationIds }
    })
  }

  if (existing) {
    return existing
  }

  try {
    return await GrantPaymentsModel.create(preparedPayload)
  } catch (err) {
    if (
      err?.code === DUPLICATE_KEY_ERROR_CODE &&
      grantCorrelationIds.length > 0
    ) {
      return GrantPaymentsModel.findOne({
        'grants.correlationId': { $in: grantCorrelationIds }
      })
    }

    throw err
  }
}
