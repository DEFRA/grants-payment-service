import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchGrantPaymentsBySbiAndGrantCode } from '#~/common/helpers/fetch-grant-payments-by-sbi-and-grant-code.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { getTestGrantPaymentsBySbiAndGrantCodeController } from './get-test-grant-payments-by-sbi-and-grant-code.controller.js'

vi.mock(
  '#~/common/helpers/fetch-grant-payments-by-sbi-and-grant-code.js',
  () => ({
    fetchGrantPaymentsBySbiAndGrantCode: vi.fn()
  })
)

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

describe('getTestGrantPaymentsBySbiAndGrantCodeController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 200 and payments for a given sbi and grantCode', async () => {
    const sbi = '123456789'
    const grantCode = 'DRD10'
    const mockPayments = [
      { id: '1', sbi },
      { id: '2', sbi }
    ]
    fetchGrantPaymentsBySbiAndGrantCode.mockResolvedValue(mockPayments)

    const req = { params: { sbi, grantCode } }
    const h = makeH()
    const result =
      await getTestGrantPaymentsBySbiAndGrantCodeController.handler(req, h)

    expect(fetchGrantPaymentsBySbiAndGrantCode).toHaveBeenCalledWith(
      sbi,
      grantCode
    )
    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual(mockPayments)
  })

  test('returns 200 and empty array when no payments found for sbi and grantCode', async () => {
    fetchGrantPaymentsBySbiAndGrantCode.mockResolvedValue([])

    const req = { params: { sbi: '999999999', grantCode: 'UNKNOWN' } }
    const h = makeH()
    const result =
      await getTestGrantPaymentsBySbiAndGrantCodeController.handler(req, h)

    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual([])
  })

  test('returns 500 for unexpected error', async () => {
    const mockError = new Error('db down')
    fetchGrantPaymentsBySbiAndGrantCode.mockRejectedValue(mockError)

    const req = {
      params: { sbi: '123456789', grantCode: 'DRD10' },
      log: vi.fn()
    }
    const h = makeH()
    const result =
      await getTestGrantPaymentsBySbiAndGrantCodeController.handler(req, h)

    expect(req.log).toHaveBeenCalledWith(['error'], mockError)
    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({ error: 'Internal Server Error' })
  })
})
