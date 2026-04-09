import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTraceId } from '@defra/hapi-tracing'
import { loggerOptions } from './logger-options.js'

vi.mock('@defra/hapi-tracing', () => ({
  getTraceId: vi.fn()
}))

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
