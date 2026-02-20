import { describe, it, expect, vi, beforeEach } from 'vitest'
import { testEndpoints } from './index.js'

describe('api test endpoints plugin', () => {
  let server
  beforeEach(() => {
    server = {
      route: vi.fn()
    }
  })

  it('registers the single POST route from controller', () => {
    testEndpoints.plugin.register(server)
    expect(server.route).toHaveBeenCalled()
    const [[routes]] = server.route.mock.calls
    expect(Array.isArray(routes)).toBe(true)
    expect(routes.length).toBeGreaterThan(0)
    // ensure that the route objects contain method and path
    expect(routes[0]).toHaveProperty('method')
    expect(routes[0]).toHaveProperty('path')
  })
})
