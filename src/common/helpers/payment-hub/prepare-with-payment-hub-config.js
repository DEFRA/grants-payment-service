import { getPaymentHubConfig } from '#~/common/helpers/config-mapper/index.js'

export function prepareWithPaymentHubConfig(grantPayment) {
  const schemeConfig = getPaymentHubConfig(grantPayment.scheme)
  if (!schemeConfig) {
    return grantPayment
  }

  const {
    deliveryBody,
    accountCode,
    fundCode,
    schemeCode,
    ...remainingSchemeConfig
  } = schemeConfig

  return {
    ...grantPayment,
    grants: (grantPayment.grants || []).map((grant) => ({
      ...grant,
      deliveryBody,
      ...remainingSchemeConfig,
      payments: (grant.payments || []).map((payment) => ({
        ...payment,
        status: 'pending',
        invoiceLines: (payment.invoiceLines || []).map((invoiceLine) => ({
          ...invoiceLine,
          ...(schemeCode ? { schemeCode } : {}),
          deliveryBody,
          accountCode,
          fundCode
        }))
      }))
    }))
  }
}
