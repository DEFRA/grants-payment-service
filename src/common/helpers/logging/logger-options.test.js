import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTraceId } from '@defra/hapi-tracing'
import { config } from '#~/config/index.js'

vi.mock('@defra/hapi-tracing', () => ({
  getTraceId: vi.fn()
}))

// Set config before importing logger-options
config.set('log.isEnabled', false)
config.set('log.redact', ['req', 'res'])
config.set('log.level', 'info')
config.set('log.format', 'pino-pretty')
config.set('serviceName', 'test-service')
config.set('serviceVersion', '1.0.0')
config.set('featureFlags.testEndpoints', false)

import { loggerOptions } from './logger-options.js'

describe('loggerOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has valid basic configuration', () => {
    expect(loggerOptions).toHaveProperty('enabled')
    expect(loggerOptions).toHaveProperty('level')
    expect(loggerOptions).toHaveProperty('redact')
    expect(loggerOptions.nesting).toBe(true)
  })

  describe('mixin', () => {
    it('returns empty object when no traceId is present', () => {
      getTraceId.mockReturnValue(null)
      const result = loggerOptions.mixin()
      expect(result).toEqual({})
    })

    it('returns trace object when traceId is present', () => {
      const fakeTraceId = 'test-trace-id'
      getTraceId.mockReturnValue(fakeTraceId)
      const result = loggerOptions.mixin()
      expect(result).toEqual({ trace: { id: fakeTraceId } })
    })
  })
})

describe('loggerOptions with testEndpoints feature flag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets redact to only x-api-key and enables logPayload when testEndpoints is enabled', () => {
    vi.resetModules()
    // Re-apply mock
    vi.doMock('@defra/hapi-tracing', () => ({
      getTraceId: vi.fn()
    }))

    // Set config with testEndpoints true first
    config.set('log.isEnabled', false)
    config.set('log.redact', ['req', 'res', 'responseTime'])
    config.set('log.level', 'info')
    config.set('log.format', 'pino-pretty')
    config.set('serviceName', 'test-service')
    config.set('serviceVersion', '1.0.0')
    config.set('featureFlags.testEndpoints', true)

    const { loggerOptions: testLoggerOptions } = require('./logger-options.js')

    expect(testLoggerOptions.redact.paths).toEqual(['req.headers.x-api-key'])
    expect(testLoggerOptions.redact.remove).toBe(false)
    expect(testLoggerOptions.logPayload).toBe(true)
  })
})
