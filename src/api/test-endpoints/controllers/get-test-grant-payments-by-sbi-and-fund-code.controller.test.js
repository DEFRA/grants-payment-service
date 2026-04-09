import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchGrantPaymentsBySbiAndFundCode } from '#~/common/helpers/fetch-grant-payments-by-sbi-and-fund-code.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { getTestGrantPaymentsBySbiAndFundCodeController } from './get-test-grant-payments-by-sbi-and-fund-code.controller.js'

vi.mock(
  '#~/common/helpers/fetch-grant-payments-by-sbi-and-fund-code.js',
  () => ({
    fetchGrantPaymentsBySbiAndFundCode: vi.fn()
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

describe('getTestGrantPaymentsBySbiAndFundCodeController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 200 and payments for a given sbi and fundCode', async () => {
    const sbi = '123456789'
    const fundCode = 'DRD10'
    const mockPayments = [
      { id: '1', sbi },
      { id: '2', sbi }
    ]
    const pagination = { page: 1, total: 1 }
    fetchGrantPaymentsBySbiAndFundCode.mockResolvedValue({
      docs: mockPayments,
      pagination
    })

    const req = { params: { sbi, fundCode } }
    const h = makeH()
    const result = await getTestGrantPaymentsBySbiAndFundCodeController.handler(
      req,
      h
    )

    expect(fetchGrantPaymentsBySbiAndFundCode).toHaveBeenCalledWith(
      sbi,
      fundCode,
      1
    )
    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual({
      sbi,
      fundCode,
      docs: mockPayments,
      pagination
    })
  })

  test('returns 200 and empty array when no payments found for sbi and fundCode', async () => {
    const pagination = { page: 1, total: 0 }
    fetchGrantPaymentsBySbiAndFundCode.mockResolvedValue({
      docs: [],
      pagination
    })

    const req = { params: { sbi: '999999999', fundCode: 'UNKNOWN' } }
    const h = makeH()
    const result = await getTestGrantPaymentsBySbiAndFundCodeController.handler(
      req,
      h
    )

    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual({
      sbi: '999999999',
      fundCode: 'UNKNOWN',
      docs: [],
      pagination
    })
  })

  test('returns 500 for unexpected error', async () => {
    const mockError = new Error('db down')
    fetchGrantPaymentsBySbiAndFundCode.mockRejectedValue(mockError)

    const req = {
      params: { sbi: '123456789', fundCode: 'DRD10' },
      log: vi.fn()
    }
    const h = makeH()
    const result = await getTestGrantPaymentsBySbiAndFundCodeController.handler(
      req,
      h
    )

    expect(req.log).toHaveBeenCalledWith(['error'], mockError)
    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({
      message: 'Internal Server Error',
      error: expect.objectContaining({ message: 'db down' })
    })
  })
})
