import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { deleteGrantPaymentsBySbiAndFundCode } from '#~/common/helpers/delete-grant-payments-by-sbi-and-fund-code.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { deleteTestGrantPaymentsBySbiAndFundCodeController } from './delete-test-grant-payments-by-sbi-and-fund-code.controller.js'

vi.mock(
  '#~/common/helpers/delete-grant-payments-by-sbi-and-fund-code.js',
  () => ({
    deleteGrantPaymentsBySbiAndFundCode: vi.fn()
  })
)

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

describe('deleteTestGrantPaymentsBySbiAndFundCodeController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 200 and deletedCount for a given sbi and fundCode', async () => {
    const sbi = '123456789'
    const fundCode = 'DRD10'
    const deletedCount = 2
    deleteGrantPaymentsBySbiAndFundCode.mockResolvedValue({ deletedCount })

    const req = { params: { sbi, fundCode } }
    const h = makeH()
    const result =
      await deleteTestGrantPaymentsBySbiAndFundCodeController.handler(req, h)

    expect(deleteGrantPaymentsBySbiAndFundCode).toHaveBeenCalledWith(
      sbi,
      fundCode
    )
    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual({ sbi, fundCode, deletedCount })
  })

  test('returns 200 and deletedCount 0 when no payments found for sbi and fundCode', async () => {
    const deletedCount = 0
    deleteGrantPaymentsBySbiAndFundCode.mockResolvedValue({ deletedCount })

    const req = { params: { sbi: '999999999', fundCode: 'UNKNOWN' } }
    const h = makeH()
    const result =
      await deleteTestGrantPaymentsBySbiAndFundCodeController.handler(req, h)

    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source).toEqual({
      sbi: '999999999',
      fundCode: 'UNKNOWN',
      deletedCount: 0
    })
  })

  test('returns 500 for unexpected error', async () => {
    const mockError = new Error('db down')
    deleteGrantPaymentsBySbiAndFundCode.mockRejectedValue(mockError)

    const req = {
      params: { sbi: '123456789', fundCode: 'DRD10' },
      log: vi.fn()
    }
    const h = makeH()
    const result =
      await deleteTestGrantPaymentsBySbiAndFundCodeController.handler(req, h)

    expect(req.log).toHaveBeenCalledWith(['error'], mockError)
    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source).toEqual({
      message: 'Internal Server Error',
      error: expect.objectContaining({ message: 'db down' })
    })
  })
})
