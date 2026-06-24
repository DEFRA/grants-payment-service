import { vi, expect } from 'vitest'

import crypto from 'node:crypto'

import { Pact, MatchersV3 } from '@pact-foundation/pact'
import { Server as ProxyServer } from 'proxy-chain'

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
let httpProxyServer

describe('cron job schedule sending a POST request to payment hub', () => {
  const provider = new Pact({
    consumer: 'grants-payment-service',
    provider: 'payment-hub',
    ...withPactDir(import.meta.url)
  })

  const wmpPaymentRequestBody = {
    sourceSystem: 'WMP',
    ledger: 'AP',
    deliveryBody: 'RP10',
    invoiceNumber: 'R00000001-V001Q1',
    frn: '987654321',
    sbi: '123456789',
    fesCode: 'FALS_WMP',
    marketingYear: '2026',
    paymentRequestNumber: 1,
    agreementNumber: '123456789',
    contractNumber: 'R00000001',
    currency: 'GBP',
    dueDate: '05/06/2026',
    remittanceDescription: 'Woodland Management Plan Payment',
    invoiceLines: [
      {
        schemeCode: '82555',
        accountCode: 'SOS710',
        fundCode: 'DRD10',
        agreementNumber: '123456789',
        description: 'G00 - Gross Value of Claim',
        value: '12.34',
        deliveryBody: 'RP10',
        marketingYear: '2026'
      }
    ],
    correlationId: 'wmp-payment-correlation-id',
    value: '-12.34',
    annualValue: '12.34'
  }

  const fpttPaymentRequestBody = {
    sourceSystem: 'FPTT',
    ledger: 'AP',
    deliveryBody: 'RP00',
    invoiceNumber: 'R00000004-V001Q1',
    frn: '12544567',
    sbi: '106284736',
    fesCode: 'FALS_FPTT',
    marketingYear: '2026',
    paymentRequestNumber: 1,
    agreementNumber: '264870631',
    contractNumber: 'R00000004',
    currency: 'GBP',
    dueDate: '05/06/2026',
    remittanceDescription: 'Farm Payments Technical Test Payment',
    invoiceLines: [
      {
        schemeCode: '84011',
        accountCode: 'SOS710',
        fundCode: 'DRD10',
        agreementNumber: '264870631',
        description: 'G00 - Gross Value of Claim',
        value: '12.63',
        deliveryBody: 'RP00',
        marketingYear: '2026'
      }
    ],
    correlationId: 'sfi-payment-correlation-id',
    value: '-12.63',
    annualValue: '702.85'
  }

  beforeAll(async () => {
    global.fetchMock.disableMocks()

    httpProxyServer = new ProxyServer({ port: 8080, verbose: true })

    await httpProxyServer.listen()
    console.log(`Proxy server is listening on port ${httpProxyServer.port}`)

    const mongoOverrides = buildIsolatedMongoOptions('payment-hub-contract')

    // Configure the application
    config.set('port', crypto.randomInt(30001, 65535))
    config.set('mongoUri', mongoOverrides.mongoUrl)
    config.set('httpProxy', 'http://localhost:8080')
    config.set('featureFlags.isPaymentHubEnabled', true)

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

    httpProxyServer.close()

    global.fetchMock.enableMocks()
  })

  it('should send a request to payment hub to setup new payment schedules', async () => {
    provider
      .addInteraction()
      .given('A customer has an active WMP grant')
      .uponReceiving('the due date for the WMP grant payment has been reached')
      .withRequest('POST', '/messages', (builder) => {
        builder.headers({
          'Content-Type': 'application/json',
          Authorization: MatchersV3.regex(
            /^SharedAccessSignature sr=http%3A%2F%2F127.0.0.1%3A\d+&sig=.*&se=.*&skn=test-key-name$/,
            'SharedAccessSignature sr=http%3A%2F%2F127.0.0.1%3A63002&sig=O64%2F7369ZY3Qh3kGCFiFkaYBaFvwJyFCnpdjQdaAZFY%3D&se=1780711740&skn=test-key-name'
          )
        })
        builder.jsonBody(wmpPaymentRequestBody)
      })
      .willRespondWith(200, (builder) => {
        builder.body('text/plain; charset=utf-8', Buffer.from(''))
      })

    await provider
      .addInteraction()
      .given('A customer has an active FPTT grant')
      .uponReceiving('the due date for the FPTT grant payment has been reached')
      .withRequest('POST', '/messages', (builder) => {
        builder.headers({
          'Content-Type': 'application/json',
          Authorization: MatchersV3.regex(
            /^SharedAccessSignature sr=http%3A%2F%2F127.0.0.1%3A\d+&sig=.*&se=.*&skn=test-key-name$/,
            'SharedAccessSignature sr=http%3A%2F%2F127.0.0.1%3A63002&sig=O64%2F7369ZY3Qh3kGCFiFkaYBaFvwJyFCnpdjQdaAZFY%3D&se=1780711740&skn=test-key-name'
          )
        })
        builder.jsonBody(fpttPaymentRequestBody)
      })
      .willRespondWith(200, (builder) => {
        builder.body('text/plain; charset=utf-8', Buffer.from(''))
      })
      .executeTest(async (mockServer) => {
        config.set('paymentHub.uri', mockServer.url)
        config.set('paymentHub.key', 'test-key')
        config.set('paymentHub.keyName', 'test-key-name')
        config.set('disabledActionCodes', [])

        // Use the date that matches the seeded payment data (2026-06-05)
        const actual = await processDailyPayments(server, null, {
          date: '2026-06-05'
        })

        expect(actual).toEqual(
          expect.objectContaining({
            results: expect.arrayContaining([
              expect.objectContaining({
                docId: expect.any(Object),
                paymentId: expect.any(Object)
              })
            ]),
            fetchDuration: expect.any(String),
            processDuration: expect.any(String),
            sendDuration: expect.any(String)
          })
        )

        expect(actual.results).toHaveLength(2)

        const backgroundTasksResult = await Promise.all(actual.backgroundTasks)
        const paymentSourceSystems = backgroundTasksResult.map(
          (task) => task.body.sourceSystem
        )
        expect(paymentSourceSystems).toEqual(
          expect.arrayContaining(['FPTT', 'WMP'])
        )
      })
  })

  it('should not send WMP request when PA3 action code is disabled', async () => {
    config.set('disabledActionCodes', ['PA3'])
    await seedDatabase()

    await provider
      .addInteraction()
      .given('A customer has an active FPTT grant')
      .uponReceiving('the due date for the FPTT grant payment has been reached')
      .withRequest('POST', '/messages', (builder) => {
        builder.headers({
          'Content-Type': 'application/json',
          Authorization: MatchersV3.regex(
            /^SharedAccessSignature sr=http%3A%2F%2F127.0.0.1%3A\d+&sig=.*&se=.*&skn=test-key-name$/,
            'SharedAccessSignature sr=http%3A%2F%2F127.0.0.1%3A63002&sig=O64%2F7369ZY3Qh3kGCFiFkaYBaFvwJyFCnpdjQdaAZFY%3D&se=1780711740&skn=test-key-name'
          )
        })
        builder.jsonBody(fpttPaymentRequestBody)
      })
      .willRespondWith(200, (builder) => {
        builder.body('text/plain; charset=utf-8', Buffer.from(''))
      })
      .executeTest(async (mockServer) => {
        config.set('paymentHub.uri', mockServer.url)
        config.set('paymentHub.key', 'test-key')
        config.set('paymentHub.keyName', 'test-key-name')
        config.set('disabledActionCodes', ['PA3'])

        // Use the date that matches the seeded payment data (2026-06-05)
        const actual = await processDailyPayments(server, null, {
          date: '2026-06-05'
        })

        // When PA3 is disabled, only FPTT payment should be processed
        expect(actual.results).toHaveLength(1)

        const backgroundTasksResult = await Promise.all(actual.backgroundTasks)
        expect(backgroundTasksResult[0].body.sourceSystem).toBe('FPTT')
      })
  })
})
