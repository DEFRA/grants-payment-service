const mockLoggerInfo = vi.fn()
const mockStart = vi.fn()

const mockServer = {
  start: mockStart,
  logger: {
    info: mockLoggerInfo
  }
}

const mockFeatureFlags = {
  testEndpoints: true,
  isPaymentHubEnabled: true
}

const createServerMock = vi.fn(() => Promise.resolve(mockServer))

vi.mock('#~/server.js', () => ({
  createServer: createServerMock
}))
vi.mock('#~/config/index.js', () => ({
  config: {
    get: (key) => {
      if (key === 'featureFlags') return mockFeatureFlags
      if (key === 'port') return 3098
      return undefined
    }
  }
}))

describe('#startServer', () => {
  let startServer

  beforeAll(async () => {
    ;({ startServer } = await import('#~/common/helpers/start-server.js'))
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  test('start up server as expected', async () => {
    await startServer()

    expect(createServerMock).toHaveBeenCalled()
    expect(mockStart).toHaveBeenCalled()
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      `Feature flags: ${JSON.stringify(mockFeatureFlags, null, 2)}`
    )
    expect(mockLoggerInfo).toHaveBeenCalledWith('Server started successfully')
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'Access your backend on http://localhost:3098'
    )
  })

  test('logs failed startup message', async () => {
    createServerMock.mockRejectedValueOnce(new Error('Server failed to start'))

    await expect(startServer()).rejects.toThrow('Server failed to start')
  })
})
