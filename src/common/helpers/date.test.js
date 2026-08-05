import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTodaysDate, getTomorrowsDate, getNextDay } from './date.js'

describe('date helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getTodaysDate', () => {
    it('returns the date portion of today in YYYY-MM-DD format', () => {
      const fakeNow = new Date('2026-02-20T12:00:00.000Z')
      vi.setSystemTime(fakeNow)

      expect(getTodaysDate()).toBe('2026-02-20')
    })
  })

  describe('getTomorrowsDate', () => {
    it.each([
      ['2024-02-28T12:00:00.000Z', '2024-02-29'],
      ['2025-01-31T12:00:00.000Z', '2025-02-01'],
      ['2025-02-28T12:00:00.000Z', '2025-03-01'],
      ['2025-12-31T23:59:59.999Z', '2026-01-01']
    ])(
      'returns the date portion of tomorrow for %s',
      (fakeNow, expectedDate) => {
        vi.setSystemTime(new Date(fakeNow))

        expect(getTomorrowsDate()).toBe(expectedDate)
      }
    )
  })

  describe('getNextDay', () => {
    it('returns the next day of a given date', () => {
      expect(getNextDay('2026-02-20')).toBe('2026-02-21')
    })

    it('handles month transitions correctly', () => {
      expect(getNextDay('2025-01-31')).toBe('2025-02-01')
    })

    it('handles year transition correctly', () => {
      expect(getNextDay('2025-12-31')).toBe('2026-01-01')
    })
  })
})
