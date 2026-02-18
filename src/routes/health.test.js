import { config } from '../config.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#healthController', () => {
  /** @type {Server} */
  let server

  beforeAll(async () => {
    config.set('serviceVersion', 'versionMock')

    const { createServer } = await import('../server.js')

    server = await createServer({
      disableSQS: true
    })
    await server.initialize()
  })

  afterAll(async () => {
    if (server) {
      await server.stop({ timeout: 0 })
    }
  })

  describe('MongoDB successfully connected', () => {
    test('Should provide expected response', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(result).toEqual({ message: 'success', version: 'versionMock' })
      expect(statusCode).toBe(statusCodes.ok)
    })
  })

  describe('MongoDB failed to connect', () => {
    test('Should return an error when MongoDB connected but the ping failed', async () => {
      // simulate mongo failure (ping resolves but reports not-ok)
      const adminSpy = vi
        .spyOn(server.db, 'admin')
        .mockReturnValue({ ping: async () => ({ ok: 0 }) })

      try {
        const { result, statusCode } = await server.inject({
          method: 'GET',
          url: '/health'
        })

        expect(result).toEqual({
          message: 'Unable to connect to backend MongoDB',
          error: 'MongoDB ping failed',
          version: 'versionMock'
        })
        expect(statusCode).toBe(statusCodes.serviceUnavailable)
      } finally {
        adminSpy.mockRestore()
      }
    })

    test('Should return an error when MongoDB is unavailable', async () => {
      // simulate mongo failure (ping throws connection error)
      const err = new Error('connection refused')
      const adminSpy = vi
        .spyOn(server.db, 'admin')
        .mockReturnValue({ ping: async () => { throw err } })

      try {
        const { result, statusCode } = await server.inject({
          method: 'GET',
          url: '/health'
        })

        expect(result).toEqual({
          message: 'Unable to connect to backend MongoDB',
          error: err.message,
          version: 'versionMock'
        })
        expect(statusCode).toBe(statusCodes.serviceUnavailable)
      } finally {
        adminSpy.mockRestore()
      }
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 */
