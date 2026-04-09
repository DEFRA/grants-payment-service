import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchGrantPaymentsBySbi } from '#~/common/helpers/fetch-grant-payments-by-sbi.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { getTestPaymentsBySbiController } from './get-test-payments-by-sbi.controller.js'

vi.mock('#~/common/helpers/fetch-grant-payments-by-sbi.js', () => ({
  fetchGrantPaymentsBySbi: vi.fn()
}))

const makeH = () => {
  const res = { statusCode: 200, source: undefined }
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

describe('getTestPaymentsBySbiController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 200 and payments for a given sbi when fetch succeeds', async () => {
    const sbi = '123456789'
    const mockPayments = [
      { id: '1', sbi },
      { id: '2', sbi }
    ]
    const pagination = { page: 1, total: 1 }
    fetchGrantPaymentsBySbi.mockResolvedValue({
      docs: mockPayments,
      pagination
    })

    const req = { params: { sbi } }
    const h = makeH()
    const result = await getTestPaymentsBySbiController.handler(req, h)

    expect(fetchGrantPaymentsBySbi).toHaveBeenCalledWith(sbi, 1)
    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual({ sbi, docs: mockPayments, pagination })
  })

  test('returns 200 and empty array when no payments found for sbi', async () => {
    const pagination = { page: 1, total: 0 }
    fetchGrantPaymentsBySbi.mockResolvedValue({ docs: [], pagination })

    const req = { params: { sbi: '999999999' } }
    const h = makeH()
    const result = await getTestPaymentsBySbiController.handler(req, h)

    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual({ sbi: '999999999', docs: [], pagination })
  })

  test('returns 500 for unexpected error', async () => {
    const mockError = new Error('db down')
    fetchGrantPaymentsBySbi.mockRejectedValue(mockError)

    const req = { params: { sbi: '123456789' }, log: vi.fn() }
    const h = makeH()
    const result = await getTestPaymentsBySbiController.handler(req, h)

    expect(req.log).toHaveBeenCalledWith(['error'], mockError)
    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({
      message: 'Internal Server Error',
      error: expect.objectContaining({ message: 'db down' })
    })
  })
})
