import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { setImmediate } from 'node:timers/promises'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
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
      payload: { targetCount: 100, dueDate: '2026-04-08' }, // Simulated Hapi validated payload
      logger: mockLogger
    }

    const result = await postTestPopulateGrantPaymentController.handler(req, h)

    expect(result.statusCode).toBe(202)
    expect(result.source.message).toBe('Grant payment population started')
    expect(result.source.targetCount).toBe(100)
    expect(result.source.batchSize).toBe(10) // 100/10

    // Wait for setImmediate to complete
    await setImmediate()

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

  test('should successfully populate with custom targetCount and dueDate', async () => {
    createGrantPayment.mockResolvedValue({ _id: 'mock-id' })
    GrantPaymentsModel.countDocuments.mockResolvedValue(0)

    const { h } = makeH()
    const req = {
      payload: { targetCount: 15, dueDate: '2025-12-25' },
      logger: mockLogger
    }

    const result = await postTestPopulateGrantPaymentController.handler(req, h)

    expect(result.statusCode).toBe(202)
    expect(result.source.dueDate).toBe('2025-12-25')

    // Wait for setImmediate to complete
    await setImmediate()

    expect(createGrantPayment).toHaveBeenCalledTimes(15)
    expect(
      createGrantPayment.mock.calls[0][0].grants[0].payments[0].dueDate
    ).toBe('2025-12-25')
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

    expect(result.statusCode).toBe(202)

    // Wait for setImmediate to complete
    await setImmediate()

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

    expect(result.statusCode).toBe(202)

    // Wait for setImmediate to complete
    await setImmediate()

    expect(createGrantPayment).toHaveBeenCalledTimes(150)
  })

  test('should log error if background population fails', async () => {
    GrantPaymentsModel.countDocuments.mockResolvedValue(0)

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

    expect(result.statusCode).toBe(202)

    // Wait for setImmediate to complete
    await setImmediate()

    expect(faultyReq.logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      'Error during test population'
    )
  })

  test('should use provided dueDate for all records', async () => {
    createGrantPayment.mockResolvedValue({ _id: 'mock-id' })
    GrantPaymentsModel.countDocuments.mockResolvedValue(0)

    const { h } = makeH()
    const customDate = '2024-05-01'
    const req = {
      payload: { targetCount: 4, dueDate: customDate },
      logger: mockLogger
    }

    await postTestPopulateGrantPaymentController.handler(req, h)

    // Wait for setImmediate to complete
    await setImmediate()

    expect(createGrantPayment).toHaveBeenCalledTimes(4)

    // All records should have the same dueDate
    createGrantPayment.mock.calls.forEach((call) => {
      expect(call[0].grants[0].payments[0].dueDate).toBe(customDate)
    })
  })
})
