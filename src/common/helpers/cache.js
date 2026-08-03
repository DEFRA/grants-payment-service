import { config } from '#~/config/index.js'

/**
 *
 * @param { import('@hapi/hapi').Server } server
 * @param { string } segment
 * @param {(id: string) => string | Promise<string>} generateFunc
 * @param {object} [options]
 * @returns { import('@hapi/catbox').Policy<string, string> }
 */
export function initCache(server, segment, generateFunc, options = {}) {
  return server.cache({
    cache: config.get('serviceName'),
    segment,
    generateTimeout: 2000,
    generateFunc,
    ...options
  })
}
