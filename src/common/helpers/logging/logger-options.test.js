import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create a reusable mock function for getTraceId
const mockGetTraceId = vi.fn()

describe('loggerOptions', () => {
  let loggerOptions

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Mock config module
    vi.doMock('#~/config/index.js', () => ({
      config: {
        get: vi.fn((key) => {
          if (key === 'log') {
            return {
              isEnabled: false,
              redact: ['req', 'res'],
              level: 'info',
              format: 'pino-pretty'
            }
          } else if (key === 'serviceName') {
            return 'test-service'
          } else if (key === 'serviceVersion') {
            return '1.0.0'
          } else if (key === 'featureFlags.testEndpoints') {
            return false
          } else {
            return undefined
          }
        }),
        set: vi.fn()
      }
    }))

    // Mock @defra/hapi-tracing
    vi.doMock('@defra/hapi-tracing', () => ({
      getTraceId: mockGetTraceId
    }))

    // Import loggerOptions
    const module = await import('./logger-options.js')
    loggerOptions = module.loggerOptions
  })

  it('has valid basic configuration', () => {
    expect(loggerOptions).toHaveProperty('enabled')
    expect(loggerOptions).toHaveProperty('level')
    expect(loggerOptions).toHaveProperty('redact')
    expect(loggerOptions.nesting).toBe(true)
  })

  describe('mixin', () => {
    it('returns empty object when no traceId is present', () => {
      mockGetTraceId.mockReturnValue(null)
      const result = loggerOptions.mixin()
      expect(result).toEqual({})
    })

    it('returns trace object when traceId is present', () => {
      const fakeTraceId = 'test-trace-id'
      mockGetTraceId.mockReturnValue(fakeTraceId)
      const result = loggerOptions.mixin()
      expect(result).toEqual({ trace: { id: fakeTraceId } })
    })
  })
})

describe('loggerOptions with testEndpoints feature flag', () => {
  let loggerOptions

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Mock config module with testEndpoints enabled
    vi.doMock('#~/config/index.js', () => ({
      config: {
        get: vi.fn((key) => {
          if (key === 'log') {
            return {
              isEnabled: false,
              redact: ['req', 'res', 'responseTime'],
              level: 'info',
              format: 'pino-pretty'
            }
          } else if (key === 'serviceName') {
            return 'test-service'
          } else if (key === 'serviceVersion') {
            return '1.0.0'
          } else if (key === 'featureFlags.testEndpoints') {
            return true
          } else {
            return undefined
          }
        }),
        set: vi.fn()
      }
    }))

    // Mock @defra/hapi-tracing
    vi.doMock('@defra/hapi-tracing', () => ({
      getTraceId: mockGetTraceId
    }))

    // Import loggerOptions
    const module = await import('./logger-options.js')
    loggerOptions = module.loggerOptions
  })

  it('sets redact to only x-api-key and enables logPayload when testEndpoints is enabled', () => {
    expect(loggerOptions.redact.paths).toEqual(['req.headers.x-api-key'])
    expect(loggerOptions.redact.remove).toBe(false)
    expect(loggerOptions.logPayload).toBe(true)
  })
})
