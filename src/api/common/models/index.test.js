import { describe, it, expect } from 'vitest'
import models from './index.js'
import grantPayments from './grant_payments.js'

describe('models/index', () => {
  it('exports all models', () => {
    expect(models.grantPayments).toBe(grantPayments)
  })
})
