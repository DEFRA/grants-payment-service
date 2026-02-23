import crypto from 'node:crypto'
import { proxyFetch } from '#~/common/helpers/fetch.js'
import { config } from '#~/config.js'
import { initCache } from '#~/common/helpers/cache.js'

let cache = null

/**
 * Generate a payment hub token
 * @returns {string} The generated token
 */
export const getPaymentHubToken = () => {
  const encoded = encodeURIComponent(config.get('paymentHub.uri'))
  const ttl = Math.round(Date.now() / 1000) + config.get('paymentHub.ttl')
  const signature = `${encoded}\n${ttl}`
  const hash = crypto
    .createHmac('sha256', config.get('paymentHub.key'))
    .update(signature)
    .digest('base64')
  return `SharedAccessSignature sr=${encoded}&sig=${encodeURIComponent(hash)}&se=${ttl}&skn=${config.get('paymentHub.keyName')}`
}

/**
 * Payment Hub token cache
 * @param { import('@hapi/hapi').Server } server
 * @returns { import('@hapi/catbox').Policy<any, any> }
 */
export const getCachedToken = (server) => {
  if (!cache) {
    cache = initCache(server, 'token', getPaymentHubToken, {
      expiresIn: config.get('paymentHub.ttl')
    })
  }
  return cache
}

/**
 * Send a request to the payment hub
 * @param { import('@hapi/hapi').Server } server
 * @param { PaymentHubPayload } body
 * @returns {Promise<object>} The response from the payment hub
 */
export const sendPaymentHubRequest = async (server, body) => {
  const { logger } = server
  if (!config.get('featureFlags.isPaymentHubEnabled')) {
    logger.warn(
      `The PaymentHub feature flag is disabled. The request has not been sent to payment hub: ${JSON.stringify(body, null, 2)}`
    )

    return {
      status: 'warning',
      message:
        'Payment Hub feature flag is disabled. Payload that would have been sent',
      body,
      response: null
    }
  }

  if (!config.get('paymentHub.keyName') || !config.get('paymentHub.key')) {
    throw new Error('Payment Hub keyname or key is not set')
  }

  const accessToken = await getCachedToken(server).get('token')
  const brokerProperties = {
    SessionId: '123'
  }

  const url = new URL(`${config.get('paymentHub.uri')}/messages`)
  const response = await proxyFetch(url, {
    method: 'POST',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
      BrokerProperties: JSON.stringify(brokerProperties)
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`Payment hub request failed: ${response.statusText}`)
  }

  logger.info('The PaymentHub request sent successfully')

  return {
    status: 'success',
    message: 'Payload sent to payment hub successfully',
    body,
    response
  }
}

/** @import { PaymentHubPayload } from '#~/common/types/payment-hub.d.js' */
