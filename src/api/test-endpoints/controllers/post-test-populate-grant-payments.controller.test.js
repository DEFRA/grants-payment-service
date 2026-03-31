import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { postTestPopulateGrantPaymentController } from './post-test-populate-grant-payments.controller.js'

vi.mock('#~/common/helpers/create-grant-payment.js', () => ({
  createGrantPayment: vi.fn()
}))

vi.mock('#~/api/common/models/grant_payments.js', () => ({
  default: {
    countDocuments: vi.fn()
  }
}))

const makeH = () => {
  const res = { statusCode: 200, source: undefined }
  const h = {
    response: (payload) => {
      res.source = payload
      return {
        code: (status) => {
          res.statusCode = status
          return res
        }
      }
    }
  }
  return { h, res }
}

describe('postTestPopulateGrantPaymentController', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should successfully populate grant payments with default values', async () => {
    createGrantPayment.mockResolvedValue({ _id: 'mock-id' })
    GrantPaymentsModel.countDocuments
      .mockResolvedValueOnce(100) // Initial count
      .mockResolvedValueOnce(200) // Final count

    const { h } = makeH()
    const req = {
      payload: {},
      logger: mockLogger
    }

    const result = await postTestPopulateGrantPaymentController.handler(req, h)

    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source.message).toBe('Population complete')
    expect(result.source.totalCreated).toBe(100)
    expect(result.source.totalErrors).toBe(0)
    expect(createGrantPayment).toHaveBeenCalledTimes(100)
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Starting test database population')
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Existing grant payments in database before creation: 100'
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Processing batch')
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Population complete')
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Total grant payments in database after creation: 200'
    )
  })

  test('should successfully populate with custom targetCount and batchSize', async () => {
    createGrantPayment.mockResolvedValue({ _id: 'mock-id' })
    GrantPaymentsModel.countDocuments.mockResolvedValue(0)

    const { h } = makeH()
    const req = {
      payload: { targetCount: 15, batchSize: 5 },
      logger: mockLogger
    }

    const result = await postTestPopulateGrantPaymentController.handler(req, h)

    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source.totalCreated).toBe(15)
    expect(createGrantPayment).toHaveBeenCalledTimes(15)
  })

  test('should handle partial failures during population', async () => {
    // Fail some calls
    createGrantPayment.mockImplementation((payload) => {
      if (payload.claimId.includes('-2') || payload.claimId.includes('-5')) {
        return Promise.reject(new Error('Mock creation error'))
      }
      return Promise.resolve({ _id: 'mock-id' })
    })
    GrantPaymentsModel.countDocuments.mockResolvedValue(0)

    const { h } = makeH()
    const req = {
      payload: { targetCount: 10, batchSize: 5 },
      logger: mockLogger
    }

    const result = await postTestPopulateGrantPaymentController.handler(req, h)

    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source.totalCreated).toBe(8)
    expect(result.source.totalErrors).toBe(2)
    expect(result.source.errors.length).toBe(2)
    expect(result.source.errors[0]).toMatchObject({
      error: 'Mock creation error'
    })
    expect(mockLogger.error).toHaveBeenCalled()
  })

  test('should limit the number of errors in response to 100', async () => {
    createGrantPayment.mockRejectedValue(new Error('Persistent error'))
    GrantPaymentsModel.countDocuments.mockResolvedValue(0)

    const { h } = makeH()
    const req = {
      payload: { targetCount: 150, batchSize: 50 },
      logger: mockLogger
    }

    const result = await postTestPopulateGrantPaymentController.handler(req, h)

    expect(result.statusCode).toBe(statusCodes.ok)
    expect(result.source.totalCreated).toBe(0)
    expect(result.source.totalErrors).toBe(150)
    expect(result.source.errors.length).toBe(100)
  })

  test('should return 500 if an unexpected error occurs in the handler', async () => {
    // Force an error in the handler loop by making targetCount non-numeric or similar,
    // but the best way is to mock something that isn't caught inside the loop.
    // Actually, the handler has a try-catch that covers the whole thing.

    GrantPaymentsModel.countDocuments.mockResolvedValue(0)

    // Let's mock req.logger to throw
    const faultyReq = {
      payload: { targetCount: 10 },
      logger: {
        info: vi.fn(() => {
          throw new Error('Logger failed')
        }),
        error: vi.fn()
      }
    }
    const { h } = makeH()

    const result = await postTestPopulateGrantPaymentController.handler(
      faultyReq,
      h
    )

    expect(result.statusCode).toBe(statusCodes.internalServerError)
    expect(result.source.message).toBe('Failed to populate test data')
  })

  test('should set dueDate based on batch number', async () => {
    createGrantPayment.mockResolvedValue({ _id: 'mock-id' })
    GrantPaymentsModel.countDocuments.mockResolvedValue(0)

    const { h } = makeH()
    const req = {
      payload: { targetCount: 4, batchSize: 2 },
      logger: mockLogger
    }

    await postTestPopulateGrantPaymentController.handler(req, h)

    expect(createGrantPayment).toHaveBeenCalledTimes(4)

    const today = new Date().toISOString().split('T')[0]
    const tomorrowDate = new Date()
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrow = tomorrowDate.toISOString().split('T')[0]

    // First batch (batchNum 0)
    expect(
      createGrantPayment.mock.calls[0][0].grants[0].payments[0].dueDate
    ).toBe(today)
    expect(
      createGrantPayment.mock.calls[1][0].grants[0].payments[0].dueDate
    ).toBe(today)

    // Second batch (batchNum 1)
    expect(
      createGrantPayment.mock.calls[2][0].grants[0].payments[0].dueDate
    ).toBe(tomorrow)
    expect(
      createGrantPayment.mock.calls[3][0].grants[0].payments[0].dueDate
    ).toBe(tomorrow)
  })
})
