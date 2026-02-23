import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTodaysDate } from './date.js'

describe('getTodaysDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the date portion of the current time in YYYY-MM-DD format', () => {
    const fakeNow = new Date('2025-12-31T23:59:59.999Z')
    vi.setSystemTime(fakeNow)

    expect(getTodaysDate()).toBe('2025-12-31')
  })
})
