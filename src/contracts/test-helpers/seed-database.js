import mongoose from 'mongoose'
import models from '#~/api/common/models/index.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'
import { handleCreatePaymentEvent } from '#~/common/helpers/sqs/message-processor/handle-create-payment.js'

async function publishSampleGrantEvents(tableData, logger) {
  for (const row of tableData) {
    const event = {
      topicArn: 'arn:aws:sns:eu-west-2:000000000000:create_payment.fifo',
      type: 'cloud.defra.dev.farming-grants-agreements-api.payment.create',
      time: new Date().toISOString(),
      data: row
    }

    await handleCreatePaymentEvent(
      event.data.notificationMessageId,
      event,
      logger
    )
  }
  logger.info(`Successfully published ${tableData.length} 'grants' documents`)
}

export async function seedDatabase(
  logger = console,
  tableData = sampleData.grants
) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Database seeding is only allowed during contract tests')
  }

  while (mongoose.connection.readyState !== mongoose.STATES.connected) {
    logger.info('Waiting for mongoose to connect...')
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  logger.info('Seeding database')

  for (const [name, model] of Object.entries(models)) {
    try {
      await model.db.dropCollection(name)
      logger.info(`Dropped collection '${name}'`)
    } catch (e) {
      logger.warn(`Error dropping collection '${name}': ${e.message}`)
    }
  }

  try {
    await publishSampleGrantEvents(tableData, logger)
  } catch (e) {
    logger.error(e)
  }
}
