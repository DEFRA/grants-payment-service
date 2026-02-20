import { vi } from 'vitest'
import { sendPaymentHubRequest } from './index.js'
import { config } from '#~/config.js'
import { initCache } from '#~/common/helpers/cache.js'
import crypto from 'crypto'

vi.mock('#~/config.js')
vi.mock('#~/common/helpers/cache.js')
vi.mock('crypto', () => ({
  __esModule: true,
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('mockedHash')
    }))
  }
}))

vi.mock('#~/api/common/helpers/logging/logger-options.js', () => ({
  loggerOptions: {
    enabled: true,
    ignorePaths: ['/health'],
    redact: {
      paths: ['password']
    }
  }
}))

vi.mock('#~/api/common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  })
}))

const globalFetch = global.fetch

describe('Payment Hub Helper', () => {
  let server
  let logger
  let mockCache
  let cachedToken

  beforeAll(() => {
    global.fetch = vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup config mock
    config.get = vi.fn((key) => {
      const configValues = {
        'paymentHub.uri': 'https://payment-hub.example.com',
        'paymentHub.ttl': '3600',
        'paymentHub.key': 'test-key',
        'paymentHub.keyName': 'test-key-name',
        'featureFlags.isPaymentHubEnabled': true,
        log: {
          enabled: true,
          level: 'info',
          format: 'json',
          redact: ['password']
        }
      }
      return configValues[key]
    })

    // Setup cache mock
    cachedToken = 'test-access-token'
    mockCache = {
      get: vi.fn().mockResolvedValue(cachedToken)
    }
    initCache.mockReturnValue(mockCache)

    // Setup server mock, include logger property
    server = {
      cache: vi.fn().mockReturnValue({ policy: vi.fn() }),
      logger: null
    }

    // Setup logger mock
    logger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    }

    server.logger = logger

    // Setup fetch mock
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true })
    })
  })

  afterAll(() => {
    global.fetch = globalFetch
  })

  describe('sendPaymentHubRequest', () => {
    it('should send a request to payment hub with correct parameters', async () => {
      const payload = { data: 'test-data' }
      const result = await sendPaymentHubRequest(server, payload)

      expect(mockCache.get).toHaveBeenCalledWith('token')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: cachedToken,
            'Content-Type': 'application/json',
            BrokerProperties: expect.any(String)
          }),
          body: JSON.stringify(payload)
        })
      )

      expect(result).toEqual(
        expect.objectContaining({
          message: 'Payload sent to payment hub successfully',
          status: 'success'
        })
      )
    })

    it('should throw an error when fetch response is not ok', async () => {
      const errorMessage = 'Bad Request'
      global.fetch.mockResolvedValue({
        ok: false,
        statusText: errorMessage
      })

      const payload = { data: 'test-data' }

      await expect(sendPaymentHubRequest(server, payload)).rejects.toThrow(
        `Payment hub request failed: ${errorMessage}`
      )

      expect(global.fetch).toHaveBeenCalled()
    })

    it('should throw an error when fetch fails', async () => {
      const networkError = new Error('Network error')
      global.fetch.mockRejectedValue(networkError)

      const payload = { data: 'test-data' }

      await expect(sendPaymentHubRequest(server, payload)).rejects.toThrow(
        networkError
      )

      expect(global.fetch).toHaveBeenCalled()
    })

    it('should throw an error if the keyname or key is not set', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'paymentHub.keyName' || key === 'paymentHub.key') {
          return undefined
        }
        return 'test-value'
      })

      const payload = { data: 'test-data' }

      await expect(sendPaymentHubRequest(server, payload)).rejects.toThrow(
        'Payment Hub keyname or key is not set'
      )

      expect(config.get).toHaveBeenCalled()
    })
  })

  // Tests for private functions by recreating their implementation for testing
  describe('Private functions', () => {
    // Implementation of the private functions for testing
    const getPaymentHubToken = () => {
      const encoded = encodeURIComponent(config.get('paymentHub.uri'))
      const ttl = config.get('paymentHub.ttl')
      const signature = encoded + '\n' + ttl
      const hash = crypto
        .createHmac('sha256', config.get('paymentHub.key'))
        .update(signature)
        .digest('base64')
      return (
        'SharedAccessSignature sr=' +
        encoded +
        '&sig=' +
        encodeURIComponent(hash) +
        '&se=' +
        ttl +
        '&skn=' +
        config.get('paymentHub.keyName')
      )
    }

    let cachedTokenInstance = null
    const getCachedToken = (serverInstance) => {
      if (!cachedTokenInstance) {
        cachedTokenInstance = initCache(
          serverInstance,
          'payment_hub_token',
          getPaymentHubToken,
          {
            expiresIn: config.get('paymentHub.ttl')
          }
        )
      }
      return cachedTokenInstance
    }

    it('should generate correct payment hub token', () => {
      const token = getPaymentHubToken()

      const expectedUri = encodeURIComponent('https://payment-hub.example.com')
      const expectedTtl = '3600'

      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', 'test-key')

      expect(token).toContain('SharedAccessSignature')
      expect(token).toContain(`sr=${expectedUri}`)
      expect(token).toContain(`se=${expectedTtl}`)
      expect(token).toContain('skn=test-key-name')
    })

    it('should initialize cache only once', () => {
      // First call should initialize the cache
      const cache1 = getCachedToken(server)
      expect(initCache).toHaveBeenCalledTimes(1)
      expect(initCache).toHaveBeenCalledWith(
        server,
        'payment_hub_token',
        expect.any(Function),
        {
          expiresIn: '3600'
        }
      )

      // Second call should reuse the existing cache
      const cache2 = getCachedToken(server)
      expect(initCache).toHaveBeenCalledTimes(1)

      // Should be the same cache instance
      expect(cache1).toBe(cache2)
    })

    it('should call the token generator when initializing cache', () => {
      // Reset the cached instance to test initialization again
      cachedTokenInstance = null

      let tokenGeneratorFn

      // Capture the token generator function
      initCache.mockImplementationOnce((serverInstance, name, generator) => {
        tokenGeneratorFn = generator
        return mockCache
      })

      // Call getCachedToken to trigger initCache
      getCachedToken(server)

      // Verify the token generator function was passed and works
      expect(typeof tokenGeneratorFn).toBe('function')

      const token = tokenGeneratorFn()
      expect(token).toContain('SharedAccessSignature')
    })
  })
})
