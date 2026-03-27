import crypto from 'node:crypto'

import { vi } from 'vitest'
import {
  MessageConsumerPact,
  synchronousBodyHandler,
  MatchersV2
} from '@pact-foundation/pact'

import { createServer } from '#~/server.js'
import { config } from '#~/config/index.js'
import { withPactDir } from '#~/contracts/test-helpers/pact.js'
import { buildIsolatedMongoOptions } from '#~/contracts/test-helpers/mongo.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'
import { toLessRestrictive } from '#~/contracts/test-helpers/pact-matchers.js'
import { handleCreatePaymentEvent } from '#~/common/helpers/sqs/message-processor/handle-create-payment.js'
import { handleCancelPaymentEvent } from '#~/common/helpers/sqs/message-processor/handle-cancel-payment.js'

const { like, iso8601DateTimeWithMillis } = MatchersV2

vi.unmock('mongoose')

let server

const messagePact = new MessageConsumerPact({
  consumer: 'grants-payment-service',
  provider: 'farming-grants-agreements-api',
  ...withPactDir(import.meta.url)
})

beforeAll(async () => {
  const mongoOverrides = buildIsolatedMongoOptions('payment-hub-contract')

  // Configure the application
  config.set('port', crypto.randomInt(30001, 65535))
  config.set('mongoUri', mongoOverrides.mongoUrl)

  // Create and start the server
  server = await createServer({
    disableSQS: true,
    ...mongoOverrides
  })
  await server.initialize()
})

afterAll(async () => {
  if (server) {
    await server.stop({ timeout: 0 })
  }
})

describe('receive a SFI grant payment event', () => {
  const messageId = 'notificationMessageId'

  it('sets up a new payment schedule', () => {
    const eventType =
      'cloud.defra.dev.farming-grants-agreements-api.payment.create'

    return messagePact
      .given('an agreement offer has been accepted')
      .expectsToReceive('a notification with the grant payment schedule')
      .withContent({
        specversion: like('1.0'),
        time: iso8601DateTimeWithMillis('2025-10-06T16:41:59.497Z'),
        topicArn: 'arn:aws:sns:eu-west-2:000000000000:create_payment.fifo',
        type: eventType,
        data: toLessRestrictive(sampleData.grants[0])
      })

      .verify(
        synchronousBodyHandler(async (payload) => {
          const mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn()
          }

          await handleCreatePaymentEvent(messageId, payload, mockLogger)

          expect(mockLogger.info.mock.calls[0][0]).toEqual({
            messageId,
            eventType,
            sbi: '106284736'
          })
          expect(mockLogger.info.mock.calls[0][1]).toBe(
            `Received create_payment payload is  ${JSON.stringify(payload, null, 2)}`
          )

          expect(mockLogger.info.mock.calls[1][0]).toContain(
            'Managed to successfully create grantPayment entry {"sbi":"'
          )
        })
      )
  })

  it('cancels an existing payment schedule', () => {
    const eventType =
      'cloud.defra.dev.farming-grants-agreements-api.payment.cancel'

    return messagePact
      .given('a payment schedule exists')
      .expectsToReceive('a notification to cancel the payment schedule')
      .withContent({
        specversion: like('1.0'),
        time: iso8601DateTimeWithMillis('2025-10-06T16:41:59.497Z'),
        topicArn: 'arn:aws:sns:eu-west-2:000000000000:cancel_payment.fifo',
        type: eventType,
        data: {
          sbi: like(sampleData.grants[0].sbi),
          frn: like(sampleData.grants[0].frn)
        }
      })

      .verify(
        synchronousBodyHandler(async (payload) => {
          const mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn()
          }

          await handleCancelPaymentEvent(messageId, payload, mockLogger)

          expect(mockLogger.info.mock.calls[0][0]).toEqual({
            messageId,
            eventType,
            sbi: '106284736'
          })
          expect(mockLogger.info.mock.calls[0][1]).toBe(
            `Received cancel_payment event with payload ${JSON.stringify(payload, null, 2)}`
          )

          expect(mockLogger.info.mock.calls[1][1]).toContain(
            'Managed to successfully cancel grantPayment entry'
          )
        })
      )
  })
})
