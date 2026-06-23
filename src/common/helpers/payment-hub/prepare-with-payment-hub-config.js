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
      deliveryBody,
      ...remainingSchemeConfig,
      ...grant,
      payments: (grant.payments || []).map((payment) => ({
        ...payment,
        status: 'pending',
        invoiceLines: (payment.invoiceLines || []).map((invoiceLine) => ({
          ...(schemeCode ? { schemeCode } : {}),
          deliveryBody,
          accountCode,
          fundCode,
          ...invoiceLine
        }))
      }))
    }))
  }
}
