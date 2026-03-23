import { config } from '#~/config/index.js'
import { createSqsConsumerPlugin } from '#~/common/helpers/sqs/sqs-consumer-plugin.js'
import { handleCancelPaymentEvent } from '#~/cancel-payment/handlers/handle-cancel-payment.js'

export const cancelPaymentSQSConsumerPlugin = {
  plugin: createSqsConsumerPlugin({
    tag: 'cancel-payment',
    queueUrl: config.get('sqs.cancelPaymentQueueUrl'),
    handler: handleCancelPaymentEvent
  })
}
