import { SQSClient } from '@aws-sdk/client-sqs'
import Boom from '@hapi/boom'
import { Consumer } from 'sqs-consumer'

import { config } from '#~/config.js'

/**
 * Parse and process a single SQS message.
 *
 * @param {(messageId: string, payload: any, logger: import('pino').Logger) => Promise<void>} handler
 * @param {import('@aws-sdk/client-sqs').Message} message
 * @param {import('pino').Logger} logger
 */
export const processMessage = async (handler, message, logger) => {
  if (!message?.Body) {
    throw Boom.badData('SQS message missing Body')
  }

  try {
    const payload = JSON.parse(message.Body)
    await handler(message.MessageId ?? 'unknown-message-id', payload, logger)
  } catch (error) {
    if (error?.name === 'SyntaxError') {
      throw Boom.badData(`Invalid message format: ${message.Body}`, error)
    }

    throw Boom.boomify(error)
  }
}

/**
 * Minimal Hapi plugin factory to start an SQS consumer.
 *
 * Uses AWS SDK v3 (`SQSClient`) plus `sqs-consumer` to:
 * - long-poll an SQS queue
 * - pass each message body (raw JSON) to a handler
 * - delete messages on successful handler completion (handled by `sqs-consumer`)
 * - log errors
 * - stop the consumer and destroy the SQS client on server shutdown
 *
 * @type {import('@hapi/hapi').Plugin<{ tag: string, queueUrl: string, handler: Function }>}
 */
export const createSqsConsumerPlugin = ({ tag, queueUrl, handler }) => ({
  plugin: {
    name: `sqs-consumer-${tag}`,
    version: '1.0.0',
    register: async (server) => {
      server.logger.info(
        `Setting up SQS consumer (${tag}) for queueUrl: ${queueUrl}`
      )

      const sqsClient = new SQSClient({
        region: config.get('aws.region'),
        endpoint: config.get('sqs.endpoint')
      })

      const consumer = Consumer.create({
        queueUrl,
        sqs: sqsClient,
        batchSize: config.get('sqs.maxMessages'),
        waitTimeSeconds: config.get('sqs.waitTime'),
        visibilityTimeout: config.get('sqs.visibilityTimeout'),
        handleMessageTimeout: 30_000,
        attributeNames: ['All'],
        messageAttributeNames: ['All'],
        handleMessage: async (message) => {
          await processMessage(handler, message, server.logger)
        }
      })

      consumer.on('started', () => {
        server.logger.info(`SQS consumer (${tag}) started`)
      })

      consumer.on('error', (err) => {
        server.logger.error(err, `SQS consumer (${tag}) error: ${err.message}`)
      })

      consumer.on('processing_error', (err) => {
        server.logger.error(
          err,
          `SQS consumer (${tag}) processing error: ${err.message}`
        )
      })

      consumer.start()

      server.events.on('stop', async () => {
        server.logger.info(`Stopping SQS consumer (${tag})`)
        consumer.stop()
        server.logger.info(`Closing SQS client (${tag})`)
        sqsClient.destroy()
      })
    }
  }
})
