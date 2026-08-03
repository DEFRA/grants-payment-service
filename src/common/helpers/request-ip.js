import { networkInterfaces } from 'node:os'

/**
 * Finds the first non-internal IPv4 address across all network interfaces.
 * @param {object} interfaces result of `networkInterfaces()`
 * @returns {{address: string}|undefined}
 */
const findNonInternalIPv4 = (interfaces) =>
  Object.values(interfaces)
    .flat()
    .find((addr) => addr?.family === 'IPv4' && !addr?.internal)

/**
 * Resolves the IP to record on the audit event.
 *  - Prefers the inbound Hapi request's own bound host, unless it's the
 *    wildcard `0.0.0.0`.
 *  - Otherwise falls back to this service's own non-internal IPv4 address
 *    (e.g. for scheduled tasks / SQS message processors where there is no
 *    inbound HTTP request to attribute).
 *  - Returns `''` if neither yields a usable address.
 * @param {import('@hapi/hapi').Request} [request]
 * @returns {string}
 */
export const getLocalIp = (request) => {
  const hapiHost = request?.server?.info?.host
  if (hapiHost && hapiHost !== '0.0.0.0') {
    return hapiHost
  }
  return findNonInternalIPv4(networkInterfaces())?.address ?? ''
}
