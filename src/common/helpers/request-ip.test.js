import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mockNetworkInterfaces = vi.hoisted(() => vi.fn())

vi.mock('node:os', () => ({
  networkInterfaces: mockNetworkInterfaces
}))

describe('getLocalIp', () => {
  let getLocalIp

  beforeEach(async () => {
    vi.resetModules()
    ;({ getLocalIp } = await import('./request-ip.js'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('returns request.server.info.host when available', () => {
    const request = { server: { info: { host: '10.0.0.5' } } }

    expect(getLocalIp(request)).toBe('10.0.0.5')
  })

  test('falls back to networkInterfaces() when no request is provided', () => {
    mockNetworkInterfaces.mockReturnValue({
      eth0: [{ address: '192.168.1.100', family: 'IPv4', internal: false }]
    })

    expect(getLocalIp()).toBe('192.168.1.100')
  })

  test('falls back to networkInterfaces() when server host is 0.0.0.0', () => {
    mockNetworkInterfaces.mockReturnValue({
      eth0: [{ address: '192.168.1.100', family: 'IPv4', internal: false }]
    })
    const request = { server: { info: { host: '0.0.0.0' } } }

    expect(getLocalIp(request)).toBe('192.168.1.100')
  })

  test('falls back to networkInterfaces() when request has no server info', () => {
    mockNetworkInterfaces.mockReturnValue({
      eth0: [{ address: '192.168.1.100', family: 'IPv4', internal: false }]
    })

    expect(getLocalIp({})).toBe('192.168.1.100')
  })

  test('skips internal interfaces', () => {
    mockNetworkInterfaces.mockReturnValue({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      eth0: [{ address: '192.168.1.100', family: 'IPv4', internal: false }]
    })

    expect(getLocalIp()).toBe('192.168.1.100')
  })

  test('skips non-IPv4 interfaces', () => {
    mockNetworkInterfaces.mockReturnValue({
      eth0: [{ address: 'fe80::1', family: 'IPv6', internal: false }]
    })

    expect(getLocalIp()).toBe('')
  })

  test('returns an empty string when no non-internal IPv4 interface is found', () => {
    mockNetworkInterfaces.mockReturnValue({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }]
    })

    expect(getLocalIp()).toBe('')
  })

  test('returns the first matching interface across multiple network interfaces', () => {
    mockNetworkInterfaces.mockReturnValue({
      eth0: [{ address: 'fe80::1', family: 'IPv6', internal: false }],
      eth1: [{ address: '10.0.0.9', family: 'IPv4', internal: false }]
    })

    expect(getLocalIp()).toBe('10.0.0.9')
  })
})
