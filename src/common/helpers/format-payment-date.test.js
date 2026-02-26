import { describe, expect, it } from 'vitest'
import { formatPaymentDate } from './format-payment-date.js'

describe('formatPaymentDate', () => {
  it('formats YYYY-MM-DD into DD/MM/YYYY', () => {
    expect(formatPaymentDate('2026-05-05')).toBe('05/05/2026')
  })

  it('throws when input is not a string', () => {
    expect(() => formatPaymentDate(null)).toThrow(
      'Payment date must be a string'
    )
  })

  it('throws when input is not YYYY-MM-DD', () => {
    expect(() => formatPaymentDate('05/05/2026')).toThrow(
      'Payment date must be in YYYY-MM-DD format'
    )
  })
})
