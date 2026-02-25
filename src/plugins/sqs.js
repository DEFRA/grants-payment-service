import { config } from '#~/config/index.js'
import { createSqsConsumerPlugin } from '#~/common/helpers/sqs/sqs-consumer-plugin.js'
import { handleCreatePaymentEvent } from '#~/create-payment/handlers/handle-create-payment.js'

export const sqs = {
  plugin: createSqsConsumerPlugin({
    tag: 'create-payment',
    queueUrl: config.get('sqs.queueUrl'),
    handler: handleCreatePaymentEvent
  })
}
