import { describe, it, expect, vi } from 'vitest'

const createMockRequest = (overrides = {}) => ({
  method: 'GET',
  raw: {
    req: { url: '/test-endpoint' },
    res: { statusCode: 200 }
  },
  headers: {},
  ...overrides
})

describe('customRequestCompleteMessage', () => {
  let customRequestCompleteMessage

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('#~/config/index.js', () => ({
      config: {
        get: vi.fn((key) => {
          if (key === 'featureFlags.testEndpoints') {
            return true
          }
          return undefined
        })
      }
    }))
    const module = await import('./request-logger.js')
    customRequestCompleteMessage =
      module.requestLogger.options.customRequestCompleteMessage
  })

  it('returns basic message without headers, request body or response', () => {
    const request = createMockRequest()
    const result = customRequestCompleteMessage(request, 100)
    expect(result).toBe('[response] GET /test-endpoint 200 (100ms)')
  })

  it('includes headers (excluding x-api-key) when present', () => {
    const request = createMockRequest({
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'secret-key',
        'user-agent': 'test-agent'
      }
    })
    const result = customRequestCompleteMessage(request, 100)
    expect(result).toContain('[response] GET /test-endpoint 200 (100ms)')
    expect(result).toContain('headers:')
    expect(result).toContain('content-type')
    expect(result).toContain('user-agent')
    expect(result).not.toContain('x-api-key')
    expect(result).not.toContain('secret-key')
  })

  it('does not include headers when none are present', () => {
    const request = createMockRequest({ headers: {} })
    const result = customRequestCompleteMessage(request, 100)
    expect(result).toBe('[response] GET /test-endpoint 200 (100ms)')
  })

  it('includes request body when payload is present', () => {
    const request = createMockRequest({
      payload: { test: 'data', value: 123 }
    })
    const result = customRequestCompleteMessage(request, 100)
    expect(result).toContain('request body:')
    expect(result).toContain('test')
    expect(result).toContain('data')
  })

  it('includes response when response.source is present', () => {
    const request = createMockRequest({
      response: {
        source: { success: true, message: 'ok' }
      }
    })
    const result = customRequestCompleteMessage(request, 100)
    expect(result).toContain('response:')
    expect(result).toContain('success')
    expect(result).toContain('ok')
  })

  it('includes headers, request body and response when all are present', () => {
    const request = createMockRequest({
      headers: { 'content-type': 'application/json' },
      payload: { test: 'data' },
      response: {
        source: { success: true }
      }
    })
    const result = customRequestCompleteMessage(request, 100)
    expect(result).toContain('headers:')
    expect(result).toContain('request body:')
    expect(result).toContain('response:')
  })

  it('handles errors gracefully', () => {
    const request = {
      method: 'GET',
      raw: {
        req: { url: '/test-endpoint' },
        res: { statusCode: 200 }
      },
      headers: null
    }
    const result = customRequestCompleteMessage(request, 100)
    expect(result).toBe('[response] GET /test-endpoint 200 (100ms)')
  })
})

describe('requestLogger', () => {
  it('includes customRequestCompleteMessage in options when testEndpoints is enabled', async () => {
    vi.resetModules()
    vi.doMock('#~/config/index.js', () => ({
      config: {
        get: vi.fn((key) => {
          if (key === 'featureFlags.testEndpoints') {
            return true
          }
          return undefined
        })
      }
    }))
    const module = await import('./request-logger.js')
    expect(
      module.requestLogger.options.customRequestCompleteMessage
    ).toBeDefined()
  })

  it('does not include customRequestCompleteMessage in options when testEndpoints is disabled', async () => {
    vi.resetModules()
    vi.doMock('#~/config/index.js', () => ({
      config: {
        get: vi.fn((key) => {
          if (key === 'featureFlags.testEndpoints') {
            return false
          }
          return undefined
        })
      }
    }))
    const module = await import('./request-logger.js')
    expect(
      module.requestLogger.options.customRequestCompleteMessage
    ).toBeUndefined()
  })
})
