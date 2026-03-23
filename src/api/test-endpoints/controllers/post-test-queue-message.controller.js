import Boom from '@hapi/boom'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { config } from '#~/config/index.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'

/**
 * Controller to post a test queue message
 * @satisfies {Partial<ServerRoute>}
 */
const postTestQueueMessageController = {
  handler: async (request, h) => {
    try {
      const queueMessage = request.payload

      if (!queueMessage) {
        throw Boom.internal('Queue message data is required')
      }

      const baseQueueUrl = config.get('sqs.queueUrl').split('/')

      request.logger.info(`****** The baseQueueUrl is: ${baseQueueUrl}`)
      const defaultQueueName = baseQueueUrl.pop()
      const { queueName = defaultQueueName } = request.params || {}
      const queueUrl = `${baseQueueUrl.join('/')}/${queueName}`

      request.logger.info(
        `Posting test queue message in: "${queueUrl}" with data: ${JSON.stringify(queueMessage)}`
      )

      const sqsClient = new SQSClient({
        region: config.get('aws.region'),
        endpoint: config.get('sqs.endpoint')
      })

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(queueMessage),
        MessageGroupId: config.get('serviceName'),
        MessageDeduplicationId: crypto.randomUUID()
      })

      const result = await sqsClient.send(command)
      request.logger.info(
        `Successfully posted test queue message to: "${queueUrl}" with MessageId: ${result.MessageId}`
      )

      return h
        .response({
          message: 'Test queue message posted'
        })
        .code(statusCodes.ok)
    } catch (error) {
      request.logger.error(error, `Error posting test queue message`)

      if (error.isBoom) {
        return error
      }

      return h
        .response({
          message: 'Failed to post test queue message',
          error: serializeError(error)
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { postTestQueueMessageController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
