import Boom from '@hapi/boom'
import { config } from '#~/config/index.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

/**
 * Parse a single Service Bus message body into a JSON payload.
 * @param {unknown} body
 * @param {string} messageId
 * @returns {object} The parsed payload
 */
const parseMessageBody = (body, messageId) => {
  if (body === null || body === undefined) {
    throw Boom.badData(
      `Service Bus message missing body for message ${messageId}`
    )
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch (error) {
      throw Boom.badData(
        `Invalid message format for message ${messageId}`,
        error
      )
    }
  }

  if (typeof body === 'object') {
    return body
  }

  throw Boom.badData(`Invalid message format for message ${messageId}`)
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Build a URL for the Service Bus HTTP endpoint.
 * @param {string} baseUrl
 * @param {string} subscription
 * @param {...string} path
 * @returns {string}
 */
const buildMessageUrl = (baseUrl, subscription, ...path) =>
  `${baseUrl}/servicebus/subscriptions/${subscription}/messages/${path.join('/')}`

/**
 * Fetch the next message from a Service Bus subscription.
 * @param {string} baseUrl
 * @param {string} subscription
 * @returns {Promise<null | { kind: 'unexpected-status', status: number } | { kind: 'message', message: object, lockToken: string | null }>}
 */
const fetchNextMessage = async (baseUrl, subscription) => {
  const response = await fetch(buildMessageUrl(baseUrl, subscription, 'head'))

  if (response.status === statusCodes.noContent) {
    return null
  }

  if (!response.ok) {
    return { kind: 'unexpected-status', status: response.status }
  }

  return {
    kind: 'message',
    message: await response.json(),
    lockToken: response.headers.get('x-lock-token')
  }
}

const completeMessage = (baseUrl, subscription, lockToken) =>
  fetch(buildMessageUrl(baseUrl, subscription, lockToken), {
    method: 'DELETE'
  })

const abandonMessage = (baseUrl, subscription, lockToken) =>
  fetch(buildMessageUrl(baseUrl, subscription, lockToken, 'abandon'), {
    method: 'POST'
  })

const getMessageId = (message) =>
  message.messageId ? String(message.messageId) : 'unknown-message-id'

/**
 * Handle a single fetched message: parse, dispatch to the handler and
 * complete (DELETE) it. The message is abandoned (POST) on any error.
 * @param {{ baseUrl: string, subscription: string, tag: string, handler: (messageId: string, payload: object, logger: import('pino').Logger) => Promise<void> | void, logger: import('pino').Logger, message: object, lockToken: string | null }} context
 */
const handleMessage = async ({
  baseUrl,
  subscription,
  tag,
  handler,
  logger,
  message,
  lockToken
}) => {
  const messageId = getMessageId(message)

  logger.info(
    `Service Bus subscription (${tag}) handling message (MessageId: ${messageId})`
  )

  try {
    const payload = parseMessageBody(message.body, messageId)

    await handler(messageId, payload, logger)

    await completeMessage(baseUrl, subscription, lockToken)
  } catch (error) {
    try {
      await abandonMessage(baseUrl, subscription, lockToken)
    } catch (abandonError) {
      logger.error(
        abandonError,
        `Service Bus subscription (${tag}) failed to abandon message`
      )
    }

    throw error
  }

  logger.info(
    `Service Bus subscription (${tag}) message processed successfully (MessageId: ${messageId})`
  )
}

/**
 * Run a single poll iteration: fetch the next message and either wait for the
 * poll interval (empty queue), back off on an unexpected status, or process it.
 * @param {{ baseUrl: string, subscription: string, tag: string, handler: (messageId: string, payload: object, logger: import('pino').Logger) => Promise<void> | void, logger: import('pino').Logger }} context
 */
const pollOnce = async ({ baseUrl, subscription, tag, handler, logger }) => {
  const next = await fetchNextMessage(baseUrl, subscription)

  if (!next) {
    await delay(config.get('serviceBus.pollIntervalMs'))
    return
  }

  if (next.kind === 'unexpected-status') {
    logger.error(
      `Service Bus HTTP poller (${tag}) unexpected status: ${next.status}`
    )
    await delay(config.get('serviceBus.errorBackoffMs'))
    return
  }

  await handleMessage({
    baseUrl,
    subscription,
    tag,
    handler,
    logger,
    message: next.message,
    lockToken: next.lockToken
  })
}

/**
 * Hapi plugin factory to poll Azure Service Bus via HTTP
 *
 * - poll the Azure Service Bus REST endpoint for new messages
 * - pass each message body (parsed JSON) to a handler
 * - complete (DELETE) or abandon (POST) the message via HTTP
 * - log errors
 * - stop polling on server shutdown
 *
 * The subscription is only registered when the
 * `featureFlags.isBatchRejectedSubscriptionEnabled` flag is enabled and a
 * `serviceBus.baseUrl` is configured.
 * @param {{ tag: string, handler: (messageId: string, payload: object, logger: import('pino').Logger) => Promise<void> | void }} options
 * @returns {import('@hapi/hapi').ServerRegisterPluginObject<void>}
 */
export const createServiceBusSubscriptionPlugin = ({ tag, handler }) => ({
  plugin: {
    name: `service-bus-subscription-${tag}`,
    version: '1.0.0',
    register: (server) => {
      const baseUrl = config.get('serviceBus.baseUrl')
      const subscription = config.get('serviceBus.batchRejected.subscription')

      if (!baseUrl) {
        throw new Error(
          'serviceBus.baseUrl is not set. The Service Bus subscription cannot start.'
        )
      }

      server.logger.info(
        `Setting up Service Bus HTTP poller (${tag}) for subscription: ${subscription}`
      )

      const state = { stopped: false }

      const poll = async () => {
        while (!state.stopped) {
          try {
            await pollOnce({
              baseUrl,
              subscription,
              tag,
              handler,
              logger: server.logger
            })
          } catch (error) {
            if (state.stopped) {
              break
            }

            server.logger.error(
              error,
              `Service Bus subscription (${tag}) error: ${error.message}`
            )
            await delay(config.get('serviceBus.errorBackoffMs'))
          }
        }
      }

      void poll()

      server.events.on('stop', () => {
        server.logger.info(`Stopping Service Bus subscription (${tag})`)
        state.stopped = true
      })
    }
  }
})
