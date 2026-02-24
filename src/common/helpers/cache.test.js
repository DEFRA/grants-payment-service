import { initCache } from '#~/common/helpers/cache.js'
import { config } from '#~/config/index.js'
import { vi } from 'vitest'

describe('initCache', () => {
  let mockServer
  let mockGenerateFunc

  beforeEach(() => {
    mockServer = {
      cache: vi.fn()
    }
    mockGenerateFunc = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('initializes cache with default options', () => {
    const segment = 'test-segment'

    initCache(mockServer, segment, mockGenerateFunc)

    expect(mockServer.cache).toHaveBeenCalledWith({
      cache: config.get('serviceName'),
      segment: 'test-segment',
      generateTimeout: 2000,
      generateFunc: mockGenerateFunc
    })
  })

  test('initializes cache with custom options', () => {
    const segment = 'test-segment'
    const customOptions = {
      expiresIn: 60000,
      staleIn: 50000
    }

    initCache(mockServer, segment, mockGenerateFunc, customOptions)

    expect(mockServer.cache).toHaveBeenCalledWith({
      cache: config.get('serviceName'),
      segment: 'test-segment',
      generateTimeout: 2000,
      generateFunc: mockGenerateFunc,
      expiresIn: 60000,
      staleIn: 50000
    })
  })
})
