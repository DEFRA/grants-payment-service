import { describe, it, expect } from 'vitest'
import { serializeError } from './serialize-error.js'

describe('serializeError', () => {
  it('serializes a standard Error object', () => {
    const error = new Error('test error')
    const serialized = serializeError(error)

    expect(serialized).toMatchObject({
      name: 'Error',
      message: 'test error'
    })
    expect(serialized.stack).toBeDefined()
  })

  it('serializes an Error with extra properties', () => {
    const error = new Error('test error')
    error.code = 'ERR_TEST'
    error.data = { foo: 'bar' }
    const serialized = serializeError(error)

    expect(serialized).toMatchObject({
      name: 'Error',
      message: 'test error',
      code: 'ERR_TEST',
      data: { foo: 'bar' }
    })
  })

  it('returns original if not an Error', () => {
    const notAnError = { foo: 'bar' }
    expect(serializeError(notAnError)).toBe(notAnError)
  })

  it('handles null and undefined', () => {
    expect(serializeError(null)).toBe(null)
    expect(serializeError(undefined)).toBe(undefined)
  })
})
