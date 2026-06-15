import { config } from '#~/config/index.js'

/**
 * Make fetch requests with exponential back-off and timeout support
 * @param {string} url - The URL to fetch
 * @param {object} options - The fetch options
 * @param {string} options.method - The HTTP method (GET, POST, etc.)
 * @param {object} options.headers - The request headers
 * @param {object} options.body - The request body
 * @param {object} logger - The logger to use
 * @returns {Promise<Response>} The fetch response
 */
export const fetchWithRetry = async (url, options, logger) => {
  const urlStr = url instanceof URL ? url.toString() : url
  const maxAttempts = config.get('fetch.maxAttempts')
  let attempt = 0
  let lastError

  while (attempt < maxAttempts) {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () =>
        controller.abort(new Error('Network timed out while fetching data')),
      config.get('fetch.timeout')
    )

    try {
      const response = await fetch(urlStr, {
        ...options,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response
    } catch (err) {
      clearTimeout(timeoutId)
      lastError = err
      const isRetryable =
        [
          'TimeoutError',
          'NetworkingError',
          'ECONNRESET',
          'ECONNREFUSED',
          'ENOTFOUND'
        ].includes(err?.name) ||
        ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND'].includes(err?.code) ||
        err?.message?.includes('network') ||
        err?.message?.includes('timeout')

      logger.error(
        {
          attempt: attempt + 1,
          maxAttempts,
          error: err?.message,
          code: err?.name,
          stack: err?.stack
        },
        `Fetch failed ${JSON.stringify({
          url: urlStr,
          signal: {
            aborted: controller.signal.aborted,
            reason: controller.signal.reason
          },
          error: {
            name: err.name,
            message: err.message,
            code: err.code,
            cause: err.cause,
            stack: err.stack,
            syscall: err.syscall,
            hostname: err.hostname,
            host: err.host,
            port: err.port,
            errno: err.errno
          },
          ...(config.get('featureFlags.testEndpoints') ? { options } : {})
        })}`
      )

      if (!isRetryable || attempt === maxAttempts - 1) {
        break
      }

      // exponential backoff
      const waitTime = 5000
      const backoffMs = Math.min(1000 * 2 ** attempt, waitTime)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
      attempt += 1
    }
  }

  throw lastError
}
