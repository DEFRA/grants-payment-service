import { vi } from 'vitest'
import mongoose from 'mongoose'
import { config } from '#~/config.js'
import { mongooseDb } from '#~/common/helpers/mongoose.js'

// Mock dependencies
vi.mock('mongoose', () => ({
  __esModule: true,
  default: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    connection: {}
  }
}))

vi.mock('#~/config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

// Get the mocked functions with proper typing
const mockMongoose = vi.mocked(mongoose)
const mockConfig = vi.mocked(config)

describe('mongooseDb', () => {
  let mockServer
  let mockLogger
  let mockOptions
  /** @type {Record<string, unknown>} */
  let configValues

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    mockServer = {
      logger: mockLogger,
      decorate: vi.fn(),
      events: {
        on: vi.fn()
      }
    }

    mockOptions = {
      mongoUrl: 'mongodb://localhost:27017',
      databaseName: 'test-db'
    }

    configValues = {
      mongo: {
        uri: mockOptions.mongoUrl,
        database: mockOptions.databaseName
      }
    }

    // Reset mocks
    vi.clearAllMocks()

    mockConfig.get.mockImplementation((key) => configValues[key])
  })

  test('plugin should have correct name and version metadata', () => {
    expect(mongooseDb.plugin.name).toBe('mongoose')
    expect(mongooseDb.plugin.version).toBe('1.0.0')
  })

  describe('register function', () => {
    test('should connect to MongoDB and set up server decorator', async () => {
      // Act
      await Promise.resolve(mongooseDb.plugin.register(mockServer, mockOptions))

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('Setting up Mongoose')
      expect(mockMongoose.connect).toHaveBeenCalledWith(mockOptions.mongoUrl, {
        dbName: mockOptions.databaseName
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Mongoose connected to MongoDB'
      )
      expect(mockServer.decorate).toHaveBeenCalledWith(
        'server',
        'mongooseDb',
        mockMongoose.connection
      )
    })

    test('should fall back to config when options are not provided', () => {
      mongooseDb.plugin.register(mockServer)

      expect(mockMongoose.connect).toHaveBeenCalledWith(configValues.mongoUri, {
        dbName: configValues.mongoDatabase
      })
    })

    test('should not seed database when feature flag is disabled', async () => {
      // Act
      await Promise.resolve(mongooseDb.plugin.register(mockServer, mockOptions))

      // Assert
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    test('should set up server stop event handler', async () => {
      // Act
      await Promise.resolve(mongooseDb.plugin.register(mockServer, mockOptions))

      // Assert
      expect(mockServer.events.on).toHaveBeenCalledWith(
        'stop',
        expect.any(Function)
      )

      // Test the stop event handler
      const stopHandler = mockServer.events.on.mock.calls[0][1]
      await stopHandler()

      expect(mockLogger.info).toHaveBeenCalledWith('Closing Mongoose client')
      expect(mockMongoose.disconnect).toHaveBeenCalled()
    })

    test('should handle mongoose connection errors', async () => {
      // Arrange
      const connectionError = new Error('Connection failed')
      mockMongoose.connect.mockRejectedValue(connectionError)

      // Act & Assert
      await expect(
        mongooseDb.plugin.register(mockServer, mockOptions)
      ).rejects.toThrow('Connection failed')

      expect(mockMongoose.connect).toHaveBeenCalled()
    })
  })
})
