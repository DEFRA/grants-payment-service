import { vi } from 'vitest'
import { config } from '#~/config/index.js'
import { fetchWithRetry } from '#~/common/helpers/fetch.js'

vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn()
  }
}))

describe('fetch helpers', () => {
  const mockUrl = 'http://example.com'
  const mockOptions = { method: 'GET' }
  const mockLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    fetch.resetMocks()
    fetch.mockResponse(JSON.stringify({ ok: true }))

    config.get.mockImplementation((key) => {
      if (key === 'fetch.timeout') return 5000
      if (key === 'fetch.maxAttempts') return 3
      if (key === 'httpProxy') return null
      return null
    })
  })

  describe('fetchWithRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should call fetch with the correct arguments and signal', async () => {
      await fetchWithRetry(mockUrl, mockOptions, mockLogger)

      expect(fetch).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          ...mockOptions,
          signal: expect.any(AbortSignal)
        })
      )
    })

    it('should abort the request when timeout is reached', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

      // Mock fetch to hang until aborted
      fetch.mockImplementationOnce((url, options) => {
        return new Promise((resolve, reject) => {
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new Error('Aborted request'))
            })
          }
        })
      })

      const fetchPromise = fetchWithRetry(mockUrl, mockOptions, mockLogger)

      vi.advanceTimersByTime(6000)

      await expect(fetchPromise).rejects.toThrow('Aborted request')

      expect(fetch).toHaveBeenCalled()
      expect(abortSpy).toHaveBeenCalledWith(expect.any(Error))
      expect(abortSpy.mock.calls[0][0].message).toBe(
        'Network timed out while fetching data'
      )
    })

    it('should clear the timeout on success', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

      await fetchWithRetry(mockUrl, mockOptions, mockLogger)

      // Advance time past the timeout
      vi.advanceTimersByTime(6000)

      expect(fetch).toHaveBeenCalled()
      // Abort should not have been called because the timer should have been cleared
      expect(abortSpy).not.toHaveBeenCalled()
    })

    it('should log the error when fetch fails', async () => {
      const fetchError = new Error('Network failure')

      fetch.mockRejectedValueOnce(fetchError)

      await expect(
        fetchWithRetry(mockUrl, mockOptions, mockLogger)
      ).rejects.toThrow(fetchError)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 3,
          error: fetchError.message,
          code: fetchError.name
        }),
        expect.stringContaining(`"url":"${mockUrl}"`)
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 3
        }),
        expect.stringContaining(`"signal":{"aborted":false`)
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 3
        }),
        expect.stringContaining(
          `"error":{"name":"Error","message":"Network failure"`
        )
      )
    })

    it('should log the error and options when fetch fails when test endpoints are enabled', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'featureFlags.testEndpoints') return true
        if (key === 'fetch.timeout') return 5000
        if (key === 'fetch.maxAttempts') return 3
        return null
      })

      const fetchError = new Error('Network failure')

      fetch.mockRejectedValueOnce(fetchError)

      await expect(
        fetchWithRetry(mockUrl, mockOptions, mockLogger)
      ).rejects.toThrow(fetchError)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 3,
          error: fetchError.message,
          code: fetchError.name
        }),
        expect.stringContaining(`"url":"${mockUrl}"`)
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 3
        }),
        expect.stringContaining(`"signal":{"aborted":false`)
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 3
        }),
        expect.stringContaining(
          `"error":{"name":"Error","message":"Network failure"`
        )
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 3
        }),
        expect.stringContaining(`"options":{"method":"GET"}`)
      )
    })

    it('should retry on retryable network errors', async () => {
      const networkError = new Error('network error')
      networkError.name = 'NetworkingError'

      fetch.mockRejectedValueOnce(networkError)
      fetch.mockResponseOnce(JSON.stringify({ ok: true }))

      const fetchPromise = fetchWithRetry(mockUrl, mockOptions, mockLogger)
      await vi.runOnlyPendingTimersAsync()
      await fetchPromise

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          maxAttempts: 3
        }),
        expect.any(String)
      )
    })

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('Invalid request')

      fetch.mockRejectedValueOnce(nonRetryableError)

      await expect(
        fetchWithRetry(mockUrl, mockOptions, mockLogger)
      ).rejects.toThrow(nonRetryableError)

      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('should exhaust max attempts and throw last error', async () => {
      const networkError = new Error('network error')
      networkError.name = 'NetworkingError'

      fetch.mockRejectedValue(networkError)

      const fetchPromise = fetchWithRetry(mockUrl, mockOptions, mockLogger)
      const assertionPromise =
        expect(fetchPromise).rejects.toThrow(networkError)
      await vi.runOnlyPendingTimersAsync()
      await vi.runOnlyPendingTimersAsync()
      await assertionPromise

      expect(fetch).toHaveBeenCalledTimes(3)
      expect(mockLogger.error).toHaveBeenCalledTimes(3)
    })

    it('should use exponential backoff between retries', async () => {
      const networkError = new Error('network error')
      networkError.name = 'NetworkingError'

      fetch.mockRejectedValueOnce(networkError)
      fetch.mockRejectedValueOnce(networkError)
      fetch.mockResponseOnce(JSON.stringify({ ok: true }))

      const fetchPromise = fetchWithRetry(mockUrl, mockOptions, mockLogger)
      await vi.runOnlyPendingTimersAsync()
      await vi.runOnlyPendingTimersAsync()
      await fetchPromise

      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('should retry on timeout errors', async () => {
      const timeoutError = new Error('timeout')
      timeoutError.name = 'TimeoutError'

      fetch.mockRejectedValueOnce(timeoutError)
      fetch.mockResponseOnce(JSON.stringify({ ok: true }))

      const fetchPromise = fetchWithRetry(mockUrl, mockOptions, mockLogger)
      await vi.runOnlyPendingTimersAsync()
      await fetchPromise

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should retry on connection reset errors', async () => {
      const connResetError = new Error('Connection reset')
      connResetError.name = 'ECONNRESET'

      fetch.mockRejectedValueOnce(connResetError)
      fetch.mockResponseOnce(JSON.stringify({ ok: true }))

      const fetchPromise = fetchWithRetry(mockUrl, mockOptions, mockLogger)
      await vi.runOnlyPendingTimersAsync()
      await fetchPromise

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should retry on connection refused errors', async () => {
      const connRefusedError = new Error('Connection refused')
      connRefusedError.name = 'ECONNREFUSED'

      fetch.mockRejectedValueOnce(connRefusedError)
      fetch.mockResponseOnce(JSON.stringify({ ok: true }))

      const fetchPromise = fetchWithRetry(mockUrl, mockOptions, mockLogger)
      await vi.runOnlyPendingTimersAsync()
      await fetchPromise

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should retry on DNS lookup errors', async () => {
      const dnsError = new Error('DNS lookup failed')
      dnsError.name = 'ENOTFOUND'

      fetch.mockRejectedValueOnce(dnsError)
      fetch.mockResponseOnce(JSON.stringify({ ok: true }))

      const fetchPromise = fetchWithRetry(mockUrl, mockOptions, mockLogger)
      await vi.runOnlyPendingTimersAsync()
      await fetchPromise

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should respect custom maxAttempts from config', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'fetch.timeout') return 5000
        if (key === 'fetch.maxAttempts') return 5
        if (key === 'httpProxy') return null
        return null
      })

      const networkError = new Error('network error')
      networkError.name = 'NetworkingError'

      fetch.mockRejectedValue(networkError)

      const fetchPromise = fetchWithRetry(mockUrl, mockOptions, mockLogger)
      const assertionPromise =
        expect(fetchPromise).rejects.toThrow(networkError)
      // Run timers multiple times to handle all 5 retry attempts (4 retries)
      for (let i = 0; i < 4; i++) {
        await vi.runOnlyPendingTimersAsync()
      }
      await assertionPromise

      expect(fetch).toHaveBeenCalledTimes(5)
    })
  })
})
