import crypto from 'node:crypto'

import { config } from '#~/config/index.js'

const SUFFIX_SANITISER = /[^a-z0-9]+/gi

export function resolveMongoUri() {
  return (
    globalThis.__MONGO_URI__ ?? process.env.MONGO_URI ?? config.get('mongoUri')
  )
}

/**
 * Builds unique Mongo connection overrides for a given suite so parallel
 * contract tests do not clobber each other's databases.
 * @param {string} suiteName
 * @param {string} [mongoUrl]
 * @returns {{ mongoUrl: string, mongoDatabase: string }}
 */
export function buildIsolatedMongoOptions(
  suiteName,
  mongoUrl = resolveMongoUri()
) {
  if (!suiteName) {
    throw new Error('suiteName is required to isolate the Mongo database')
  }
  if (!mongoUrl) {
    throw new Error('mongoUrl is required to isolate the Mongo database')
  }

  const suffix = suiteName.replace(SUFFIX_SANITISER, '-').toLowerCase()
  const uniqueSegment = crypto.randomUUID().slice(0, 8)

  return {
    mongoUrl,
    mongoDatabase: `contracts-${suffix}-${uniqueSegment}`
  }
}
