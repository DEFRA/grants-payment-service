import { MatchersV2 } from '@pact-foundation/pact'

const { like, eachLike } = MatchersV2

/**
 * Recursively converts an object or array into a Pact MatcherV2 structure.
 * Objects are wrapped in `like()`.
 * Arrays are wrapped in `eachLike()` using the first element as the template.
 *
 * @param {any} data - The data to convert.
 * @returns {any} The Pact matcher structure.
 */
export const toLessRestrictive = (data) => {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return eachLike({})
    }
    return eachLike(toLessRestrictive(data[0]))
  }

  if (data !== null && typeof data === 'object') {
    const result = {}
    for (const key of Object.keys(data)) {
      result[key] = toLessRestrictive(data[key])
    }
    return like(result)
  }

  return like(data)
}
