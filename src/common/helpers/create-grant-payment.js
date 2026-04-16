import { randomUUID } from 'node:crypto'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { prepareWithPaymentHubConfig } from '#~/common/helpers/payment-hub/prepare-with-payment-hub-config.js'

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

export const createGrantPayment = async (payload) => {
  const preparedPayload = addCorrelationId(prepareWithPaymentHubConfig(payload))
  return GrantPaymentsModel.create(preparedPayload)
}
