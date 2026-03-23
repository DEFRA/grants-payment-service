// Mock AWS SQS with proper constructor BEFORE importing module under test
import Boom from '@hapi/boom'
import { postTestQueueMessageController } from './post-test-queue-message.controller.js'
import { __mockSend as sendMock } from '@aws-sdk/client-sqs'
import { statusCodes } from '#~/common/constants/status-codes.js'

vi.mock('@aws-sdk/client-sqs', () => {
  const mockSend = vi.fn()
  return {
    SQSClient: vi.fn().mockImplementation(function () {
      this.send = mockSend
      return this
    }),
    SendMessageCommand: vi.fn().mockImplementation(function (input) {
      this.input = input
      return this
    }),
    __mockSend: mockSend // Export the mock for use in tests
  }
})

// Mock config BEFORE importing module under test
vi.mock('#~/config/index.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'aws.region') return 'eu-west-2'
      if (key === 'sqs.endpoint') return 'http://localhost:4566'
      if (key === 'sqs.queueUrl') {
        return 'http://localhost:4566/000000000000/test-queue'
      }
      return undefined
    })
  }
}))

describe('postTestQueueMessageController', () => {
  const h = {
    response: vi.fn((payload) => ({
      code: vi.fn((status) => ({ payload, statusCode: status }))
    }))
  }
  const logger = { info: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'test-uuid')
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const payload = {
    type: 'farming-grants-agreements-api.payment.create',
    data: {
      sbi: '123456789',
      frn: '9999999999',
      grants: [
        {
          sourceSystem: 'FPTT',
          payments: [{ dueDate: '2026-06-05', invoiceLines: [] }]
        }
      ]
    }
  }

  test('returns 400 when controller hits Boom error from downstream', async () => {
    sendMock.mockRejectedValueOnce(Boom.badRequest('Invalid request'))

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: {} },
      h
    )
    expect(res.output.statusCode).toBe(400)
    expect(logger.error).toHaveBeenCalled()
  })

  test('returns 500 on unexpected errors', async () => {
    sendMock.mockRejectedValueOnce(new Error('sqs down'))
    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: {} },
      h
    )
    expect(res.statusCode).toBe(500)
    expect(logger.error).toHaveBeenCalled()
  })

  test('validates payload presence', async () => {
    const err = await postTestQueueMessageController.handler(
      { payload: null, logger, params: {} },
      h
    )
    expect(Boom.isBoom(err)).toBe(true)
    expect(err.output.statusCode).toBe(500)
  })

  test('successfully posts message to default queue', async () => {
    sendMock.mockResolvedValueOnce({})

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: {} },
      h
    )

    expect(res.statusCode).toBe(statusCodes.ok)
    expect(res.payload.message).toBe('Test queue message posted')
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          QueueUrl: 'http://localhost:4566/000000000000/test-queue',
          MessageBody: JSON.stringify(payload),
          MessageDeduplicationId: 'test-uuid'
        })
      })
    )
  })

  test('successfully posts message to custom queue', async () => {
    sendMock.mockResolvedValueOnce({})

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: { queueName: 'custom-queue' } },
      h
    )

    expect(res.statusCode).toBe(statusCodes.ok)
    expect(res.payload).toEqual({
      message: 'Test queue message posted'
    })
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          QueueUrl: 'http://localhost:4566/000000000000/custom-queue',
          MessageBody: JSON.stringify(payload),
          MessageDeduplicationId: 'test-uuid'
        })
      })
    )
  })

  test('logs queue message posting', async () => {
    sendMock.mockResolvedValueOnce({})

    await postTestQueueMessageController.handler(
      { payload, logger, params: { queueName: 'test-queue' } },
      h
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Posting test queue message in: "http://localhost:4566/000000000000/test-queue"'
      )
    )
  })

  test('handles Boom errors correctly', async () => {
    const boomError = Boom.badRequest('Invalid request')
    sendMock.mockRejectedValueOnce(boomError)

    const res = await postTestQueueMessageController.handler(
      { payload, logger, params: {} },
      h
    )

    expect(res).toBe(boomError)
  })
})
