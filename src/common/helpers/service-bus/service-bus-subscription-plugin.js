import { ServiceBusClient } from '@azure/service-bus'
import Boom from '@hapi/boom'

import { config } from '#~/config/index.js'

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

/**
 * Hapi plugin factory to start a Service Bus subscription consumer.
 *
 * Uses `@azure/service-bus` to:
 * - subscribe to an Azure Service Bus topic subscription
 * - pass each message body (parsed JSON) to a handler
 * - auto-complete messages on successful handler completion
 * - log errors
 * - close the receiver and client on server shutdown
 *
 * The subscription is only registered when the
 * `featureFlags.isBatchRejectedSubscriptionEnabled` flag is enabled and a
 * `serviceBus.connectionString` is configured.
 * @param {{ tag: string, handler: (messageId: string, payload: object, logger: import('pino').Logger) => Promise<void> | void }} options
 * @returns {import('@hapi/hapi').ServerRegisterPluginObject<void>}
 */
export const createServiceBusSubscriptionPlugin = ({ tag, handler }) => ({
  plugin: {
    name: `service-bus-subscription-${tag}`,
    version: '1.0.0',
    register: (server) => {
      const connectionString = config.get('serviceBus.connectionString')

      if (!connectionString) {
        throw new Error(
          'serviceBus.connectionString is not set. The Service Bus subscription cannot start.'
        )
      }

      const topic = config.get('serviceBus.batchRejected.topic')
      const subscription = config.get('serviceBus.batchRejected.subscription')

      server.logger.info(
        `Setting up Service Bus subscription (${tag}) for topic: ${topic} subscription: ${subscription}`
      )

      const client = new ServiceBusClient(connectionString)
      const receiver = client.createReceiver(topic, subscription, {
        receiveMode: 'peekLock'
      })

      const subscriptionInstance = receiver.subscribe({
        processMessage: async (message) => {
          const messageId = message.messageId
            ? String(message.messageId)
            : 'unknown-message-id'

          server.logger.info(
            `Service Bus subscription (${tag}) handling message (MessageId: ${messageId})`
          )

          const payload = parseMessageBody(message.body, messageId)

          await handler(messageId, payload, server.logger)

          server.logger.info(
            `Service Bus subscription (${tag}) message processed successfully (MessageId: ${messageId})`
          )
        },
        processError: (args) => {
          server.logger.error(
            args.error,
            `Service Bus subscription (${tag}) error: ${args.error.message}`
          )

          return Promise.resolve()
        }
      })

      server.events.on('stop', () => {
        server.logger.info(`Stopping Service Bus subscription (${tag})`)

        void (async () => {
          await subscriptionInstance.close()
          await receiver.close()
          await client.close()
        })()
      })
    }
  }
})
