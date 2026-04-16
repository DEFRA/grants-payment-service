import { v4 as uuidv4 } from 'uuid'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { prepareWithPaymentHubConfig } from '#~/common/helpers/payment-hub/prepare-with-payment-hub-config.js'

const addCorrelationId = (grantPayment) => ({
  ...grantPayment,
  grants: (grantPayment.grants || []).map((grant) => ({
    ...grant,
    correlationId: grant.correlationId || uuidv4(),
    payments: (grant.payments || []).map((payment) => ({
      ...payment,
      correlationId: payment.correlationId || uuidv4()
    }))
  }))
})

export const createGrantPayment = async (payload) => {
  const preparedPayload = addCorrelationId(prepareWithPaymentHubConfig(payload))
  return GrantPaymentsModel.create(preparedPayload)
}
