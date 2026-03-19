import { getPaymentHubConfig } from '#~/common/helpers/config-mapper/index.js'

export const prepareWithPaymentHubConfig = (grantPayment) => {
  const schemeConfig = getPaymentHubConfig(grantPayment.scheme)
  if (!schemeConfig) {
    return grantPayment
  }

  const { deliveryBody, accountCode, fundCode, ...remainingSchemeConfig } =
    schemeConfig
  const grants = (grantPayment.grants || []).map((grant) => {
    grant.deliveryBody = deliveryBody
    const payments = (grant.payments || []).map((payment) => {
      payment.status = 'pending'
      const invoiceLines = (payment.invoiceLines || []).map((invoiceLine) => ({
        ...invoiceLine,
        deliveryBody,
        accountCode,
        fundCode
      }))
      return {
        ...payment,
        invoiceLines
      }
    })

    return {
      ...grant,
      ...remainingSchemeConfig,
      payments
    }
  })

  return {
    ...grantPayment,
    grants
  }
}
