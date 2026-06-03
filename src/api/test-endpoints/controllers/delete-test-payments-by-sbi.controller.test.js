import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { deleteGrantPaymentsBySbi } from '#~/common/helpers/delete-grant-payments-by-sbi.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { deleteTestPaymentsBySbiController } from './delete-test-payments-by-sbi.controller.js'

vi.mock('#~/common/helpers/delete-grant-payments-by-sbi.js', () => ({
  deleteGrantPaymentsBySbi: vi.fn()
}))

const makeH = () => {
  const res = { statusCode: 200, source: null }
  return {
    response: (payload) => ({
      code: (status) => {
        res.statusCode = status
        res.source = payload
        return res
      }
    })
  }
}

describe('deleteTestPaymentsBySbiController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 200 and deletedCount for a given sbi when delete succeeds', async () => {
    const sbi = '123456789'
    const deletedCount = 2
    deleteGrantPaymentsBySbi.mockResolvedValue({ deletedCount })

    const req = { params: { sbi } }
    const h = makeH()
    const result = await deleteTestPaymentsBySbiController.handler(req, h)

    expect(deleteGrantPaymentsBySbi).toHaveBeenCalledWith(sbi)
    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual({ sbi, deletedCount })
  })

  test('returns 200 and deletedCount 0 when no payments found for sbi', async () => {
    const deletedCount = 0
    deleteGrantPaymentsBySbi.mockResolvedValue({ deletedCount })

    const req = { params: { sbi: '999999999' } }
    const h = makeH()
    const result = await deleteTestPaymentsBySbiController.handler(req, h)

    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual({ sbi: '999999999', deletedCount: 0 })
  })

  test('returns 500 for unexpected error', async () => {
    const mockError = new Error('db down')
    deleteGrantPaymentsBySbi.mockRejectedValue(mockError)

    const req = { params: { sbi: '123456789' }, log: vi.fn() }
    const h = makeH()
    const result = await deleteTestPaymentsBySbiController.handler(req, h)

    expect(req.log).toHaveBeenCalledWith(['error'], mockError)
    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({
      message: 'Internal Server Error',
      error: expect.objectContaining({ message: 'db down' })
    })
  })
})
