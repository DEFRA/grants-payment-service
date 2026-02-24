import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAllGrantPayments } from '#~/common/helpers/fetch-all-grant-payments.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { getTestGrantPaymentController } from './get-test-grant-payments.controller.js'

vi.mock('#~/common/helpers/fetch-all-grant-payments.js', () => ({
  fetchAllGrantPayments: vi.fn()
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

describe('getTestGrantPaymentController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 200 and all grant payments when fetch succeeds', async () => {
    const mockPayments = [
      { id: '1', amount: 100 },
      { id: '2', amount: 200 }
    ]
    fetchAllGrantPayments.mockResolvedValue(mockPayments)

    const req = {
      log: vi.fn()
    }
    const h = makeH()
    const result = await getTestGrantPaymentController.handler(req, h)

    expect(fetchAllGrantPayments).toHaveBeenCalled()
    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual(mockPayments)
  })

  test('returns 500 for unexpected error', async () => {
    const mockError = new Error('db down')
    fetchAllGrantPayments.mockRejectedValue(mockError)

    const req = {
      log: vi.fn()
    }
    const h = makeH()
    const result = await getTestGrantPaymentController.handler(req, h)

    expect(req.log).toHaveBeenCalledWith(['error'], mockError)
    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({ error: 'Internal Server Error' })
  })
})
