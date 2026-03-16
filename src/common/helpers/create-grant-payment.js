import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { prepareWithPaymentHubConfig } from '#~/common/helpers/payment-hub/prepare-with-payment-hub-config.js'

export const createGrantPayment = async (payload) => {
  const preparedPayload = prepareWithPaymentHubConfig(payload)
  return GrantPaymentsModel.create(preparedPayload)
}
