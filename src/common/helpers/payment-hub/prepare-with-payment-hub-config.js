import { getPaymentHubConfig } from '#~/common/helpers/config-mapper/index.js'

/**
 * Applies the payment hub scheme configuration to a grant payment
 * @param {{
 *   sbi: string,
 *   frn: string,
 *   claimId: string,
 *   scheme: string,
 *   grants?: Array<{
 *     payments?: Array<{
 *       invoiceLines?: Array<Record<string, never>>
 *     }>
 *   }>
 * }} grantPayment - The payment to configure
 * @returns {object} The configured payment
 */
export function prepareWithPaymentHubConfig(grantPayment) {
  const schemeConfig = getPaymentHubConfig(grantPayment.scheme)
  if (!schemeConfig) {
    return grantPayment
  }

  const { deliveryBody, accountCode, fundCode, ...remainingSchemeConfig } =
    schemeConfig

  return {
    ...grantPayment,
    grants: (grantPayment.grants ?? []).map((grant) => ({
      deliveryBody,
      ...remainingSchemeConfig,
      ...grant,
      payments: (grant.payments ?? []).map((payment) => ({
        ...payment,
        status: 'pending',
        invoiceLines: (payment.invoiceLines ?? []).map((invoiceLine) => ({
          deliveryBody,
          accountCode,
          fundCode,
          ...invoiceLine
        }))
      }))
    }))
  }
}
