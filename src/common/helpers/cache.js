/**
 *
 * @param { import('@hapi/hapi').Server } server
 * @param { string } segment
 * @param { Function } generateFunc
 * @param { any } [options]
 * @returns { import('@hapi/catbox').Policy<any, any> }
 */
export function initCache(server, segment, generateFunc, options = {}) {
  return server.cache({
    segment,
    generateTimeout: 2000,
    generateFunc,
    ...options
  })
}
