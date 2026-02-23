import { describe, it, expect, vi, beforeEach } from 'vitest'
import { router } from './router.js'
import { config } from '#~/config.js'

vi.mock('#~/config.js')
// stub the imported routes so we can inspect them
vi.mock('#~/routes/health/index.js', () => ({
  health: { path: '/health' }
}))
vi.mock('#~/routes/test-endpoints/index.js', () => ({
  testEndpoints: { plugin: { name: 'testEndpoints' } }
}))

describe('router plugin', () => {
  let server
  let healthRoute

  beforeEach(() => {
    vi.clearAllMocks()
    healthRoute = { path: '/health' }

    server = {
      route: vi.fn(),
      register: vi.fn(),
      logger: {
        warn: vi.fn()
      }
    }

    // default config.get behavior
    config.get = vi.fn((key) => {
      const values = {
        'featureFlags.testEndpoints': false
      }
      return values[key]
    })
  })

  it('always registers health route', async () => {
    await router.plugin.register(server)
    expect(server.route).toHaveBeenCalledWith([healthRoute])
  })

  it('does not register test endpoints when flag is false', async () => {
    config.get.mockReturnValue(false)
    await router.plugin.register(server)
    expect(server.register).not.toHaveBeenCalled()
    expect(server.logger.warn).not.toHaveBeenCalled()
  })

  it('warns and registers test endpoints when flag is true', async () => {
    // return true only for the specific key
    config.get.mockImplementation((key) => key === 'featureFlags.testEndpoints')

    const { router: subRouter } = await import('./router.js')
    await subRouter.plugin.register(server)

    expect(server.logger.warn).toHaveBeenCalledWith(
      'Test endpoints are enabled. These should not be used in production.'
    )
    expect(server.register).toHaveBeenCalled()
    const [[arg]] = server.register.mock.calls
    expect(arg).toEqual([expect.any(Object)])
  })
})
