import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTomorrowsDate, getTodaysDate, getPreviousDay } from './date.js'

describe('date helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getTomorrowsDate', () => {
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

  describe('getTodaysDate', () => {
    it('returns the date portion of today in YYYY-MM-DD format', () => {
      const fakeNow = new Date('2026-02-20T12:00:00.000Z')
      vi.setSystemTime(fakeNow)

      expect(getTodaysDate()).toBe('2026-02-20')
    })
  })

  describe('getPreviousDay', () => {
    it('returns the previous day of a given date', () => {
      expect(getPreviousDay('2026-02-20')).toBe('2026-02-19')
    })

    it('handles month transitions correctly', () => {
      expect(getPreviousDay('2025-02-01')).toBe('2025-01-31')
    })

    it('handles year transition correctly', () => {
      expect(getPreviousDay('2026-01-01')).toBe('2025-12-31')
    })
  })
})
