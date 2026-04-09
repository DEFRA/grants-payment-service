import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compressResponsePlugin } from './compressResponse.js'

describe('compressResponse plugin', () => {
  let server
  let extensionHandler

  beforeEach(() => {
    vi.clearAllMocks()
    server = {
      ext: vi.fn((event, handler) => {
        if (event === 'onRequest') {
          extensionHandler = handler
        }
      })
    }
  })

  it('registers the plugin and sets up onRequest extension', async () => {
    await compressResponsePlugin.plugin.register(server, {})
    expect(server.ext).toHaveBeenCalledWith('onRequest', expect.any(Function))
    expect(compressResponsePlugin.plugin.name).toBe('compressResponse')
  })

  describe('onRequest extension handler', () => {
    let request, h

    beforeEach(async () => {
      await compressResponsePlugin.plugin.register(server, {})
      request = {
        headers: {},
        info: {}
      }
      h = {
        continue: Symbol('continue')
      }
    })

    it('continues if accept-encoding header is missing', () => {
      const result = extensionHandler(request, h)
      expect(result).toBe(h.continue)
      expect(request.headers['accept-encoding']).toBeUndefined()
    })

    it('continues and does not modify header if concrete encoding is present', () => {
      request.headers['accept-encoding'] = 'gzip'
      const result = extensionHandler(request, h)
      expect(result).toBe(h.continue)
      expect(request.headers['accept-encoding']).toBe('gzip')
    })

    it('continues and does not modify header if multiple concrete encodings are present', () => {
      request.headers['accept-encoding'] = 'gzip, deflate, br'
      const result = extensionHandler(request, h)
      expect(result).toBe(h.continue)
      expect(request.headers['accept-encoding']).toBe('gzip, deflate, br')
    })

    it('overrides accept-encoding with default (gzip) if only wildcard is present', () => {
      request.headers['accept-encoding'] = '*'
      const result = extensionHandler(request, h)
      expect(result).toBe(h.continue)
      expect(request.headers['accept-encoding']).toBe('gzip')
      expect(request.info.acceptEncoding).toBe('gzip')
    })

    it('overrides accept-encoding with default if wildcard is present without known concrete encodings', () => {
      request.headers['accept-encoding'] = 'identity, *'
      const result = extensionHandler(request, h)
      expect(result).toBe(h.continue)
      expect(request.headers['accept-encoding']).toBe('gzip')
      expect(request.info.acceptEncoding).toBe('gzip')
    })

    it('does not override if concrete encoding is present alongside wildcard', () => {
      request.headers['accept-encoding'] = 'gzip, *'
      const result = extensionHandler(request, h)
      expect(result).toBe(h.continue)
      expect(request.headers['accept-encoding']).toBe('gzip, *')
    })

    it('uses custom defaultEncoding from plugin options', async () => {
      // Re-register with options
      await compressResponsePlugin.plugin.register(server, {
        defaultEncoding: 'br'
      })
      request.headers['accept-encoding'] = '*'
      const result = extensionHandler(request, h)
      expect(result).toBe(h.continue)
      expect(request.headers['accept-encoding']).toBe('br')
      expect(request.info.acceptEncoding).toBe('br')
    })
  })
})
