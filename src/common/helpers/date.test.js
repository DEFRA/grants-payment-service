import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTomorrowsDate } from './date.js'

describe('getTomorrowsDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the date portion of tomorrow in YYYY-MM-DD format', () => {
    const fakeNow = new Date('2025-12-31T23:59:59.999Z')
    vi.setSystemTime(fakeNow)

    expect(getTomorrowsDate()).toBe('2026-01-01')
  })

  it('handles month transitions correctly', () => {
    const fakeNow = new Date('2025-01-31T12:00:00.000Z')
    vi.setSystemTime(fakeNow)

    expect(getTomorrowsDate()).toBe('2025-02-01')
  })

  it('handles leap year correctly', () => {
    const fakeNow = new Date('2024-02-28T12:00:00.000Z')
    vi.setSystemTime(fakeNow)

    expect(getTomorrowsDate()).toBe('2024-02-29')
  })

  it('handles non-leap year correctly', () => {
    const fakeNow = new Date('2025-02-28T12:00:00.000Z')
    vi.setSystemTime(fakeNow)

    expect(getTomorrowsDate()).toBe('2025-03-01')
  })

  it('handles year transition correctly', () => {
    const fakeNow = new Date('2025-12-31T23:59:59.999Z')
    vi.setSystemTime(fakeNow)

    expect(getTomorrowsDate()).toBe('2026-01-01')
  })
})
