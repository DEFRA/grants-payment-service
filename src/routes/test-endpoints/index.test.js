import { describe, it, expect, vi } from 'vitest'
import { testEndpoints } from './index.js'

// We don't need to import the controllers; plugin just spreads them into route objects

describe('routes/test-endpoints plugin', () => {
  it('registers both POST and GET routes with correct methods and paths', () => {
    const server = { route: vi.fn() }

    testEndpoints.plugin.register(server)

    expect(server.route).toHaveBeenCalled()
    const [[routes]] = server.route.mock.calls
    expect(routes).toHaveLength(2)

    const methods = routes.map((r) => r.method)
    const paths = routes.map((r) => r.path)
    expect(methods).toEqual(['POST', 'GET'])
    expect(paths).toEqual([
      '/test/process-payments/{date?}',
      '/test/daily-payments/{date?}'
    ])
  })
})
