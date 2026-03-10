import { vi } from 'vitest'

import crypto from 'node:crypto'

import { Pact, MatchersV3 } from '@pact-foundation/pact'

import { createServer } from '#~/server.js'
import { config } from '#~/config/index.js'
import { withPactDir } from '#~/contracts/test-helpers/pact.js'
import { buildIsolatedMongoOptions } from '#~/contracts/test-helpers/mongo.js'
import { seedDatabase } from '#~/contracts/test-helpers/seed-database.js'
import { processDailyPayments } from '#~/common/helpers/payment-processor.js'

vi.unmock('mongoose')

vi.mock('#~/api/common/helpers/sns-publisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(true)
}))

let server

describe('cron job schedule sending a POST request to payment hub', () => {
  const provider = new Pact({
    consumer: 'grants-payment-service',
    provider: 'payment-hub',
    logLevel: process.env.CI ? 'info' : 'debug',
    ...withPactDir(import.meta.url)
  })

  beforeAll(async () => {
    global.fetchMock.disableMocks()
    vi.useFakeTimers()

    const mongoOverrides = buildIsolatedMongoOptions('payment-hub-contract')

    // Configure the application
    config.set('port', crypto.randomInt(30001, 65535))
    config.set('mongoUri', mongoOverrides.mongoUrl)
    config.set('featureFlags.isPaymentHubEnabled', true)

    const date = new Date(2026, 5, 5, 2, 9)
    vi.setSystemTime(date)

    // Create and start the server
    server = await createServer({
      disableSQS: true,
      ...mongoOverrides
    })
    await server.initialize()
    await seedDatabase()
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }
    config.set('featureFlags.isPaymentHubEnabled', false)

    vi.useRealTimers()
    global.fetchMock.enableMocks()
  })

  it('should send a request to payment hub to setup a new payment schedule', async () => {
    return await provider
      .addInteraction()
      .given('A customer has an active SFI grant')
      .uponReceiving('the due date for the grant payment has been reached')
      .withRequest('POST', '/messages', (builder) => {
        builder.headers({
          'Content-Type': 'application/json',
          Authorization: MatchersV3.regex(
            /^SharedAccessSignature sr=http%3A%2F%2F127.0.0.1%3A\d+&sig=.*&se=.*&skn=test-key-name$/,
            'SharedAccessSignature sr=http%3A%2F%2F127.0.0.1%3A63002&sig=O64%2F7369ZY3Qh3kGCFiFkaYBaFvwJyFCnpdjQdaAZFY%3D&se=1780711740&skn=test-key-name'
          ),
          brokerproperties: MatchersV3.regex(
            /\{"SessionId":".*"\}/,
            '{"SessionId":"123"}'
          )
        })
        builder.jsonBody({
          sourceSystem: 'FPTT',
          ledger: 'AP',
          deliveryBody: 'RP00',
          invoiceNumber: 'R00000004-V001Q2',
          fesCode: 'FALS_FPTT',
          marketingYear: '2026',
          paymentRequestNumber: 1,
          agreementNumber: 'FPTT264870631',
          currency: 'GBP',
          dueDate: '05/06/2026',
          remittanceDescription: 'Farm Payments Technical Test Payment',
          invoiceLines: [
            {
              schemeCode: 'CMOR1',
              accountCode: 'SOS710',
              fundCode: 'DRD10',
              agreementNumber: 'FPTT264870631',
              description:
                'Parcel 8083 - Assess moorland and produce a written record',
              value: '12.63',
              deliveryBody: 'RP00',
              marketingYear: '2026'
            }
          ],
          correlationId: '7cf9bd11-c791-42c9-bd28-fa0fec_id',
          value: '702.85'
        })
      })
      .willRespondWith(200, (builder) => {
        builder.body('text/plain; charset=utf-8', Buffer.from(''))
      })
      .executeTest(async (mockServer) => {
        config.set('paymentHub.uri', mockServer.url)
        config.set('paymentHub.key', 'test-key')
        config.set('paymentHub.keyName', 'test-key-name')

        expect(new Date().toISOString()).toContain('2026-06-05T02:09')

        await processDailyPayments(server)
      })
  })
})
