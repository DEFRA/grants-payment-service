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
import { handleCreatePaymentEvent } from '#~/create-payment/handlers/handle-create-payment.js'
import sampleData from '#~/api/common/helpers/sample-data/index.js'
import { toLessRestrictive } from '#~/contracts/test-helpers/pact-matchers.js'

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
  const eventType =
    'cloud.defra.dev.farming-grants-agreements-api.payment.create'

  it('sets up a new payment schedule', () => {
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
})
