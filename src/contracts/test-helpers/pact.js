import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pactOutputDir = path.resolve('src', 'contracts', 'consumer', 'pacts')
const pactGeneratedDir = path.join(pactOutputDir, 'generated')

const stripExtension = (filename) =>
  filename.replace(/(\.contract)?\.test\.js$/i, '').replace(/\.js$/i, '')

const formatSegment = (value) =>
  stripExtension(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const resolvePactDirectory = (testFileUrl) => {
  const testFilePath = fileURLToPath(testFileUrl)
  const parentName = formatSegment(path.basename(path.dirname(testFilePath)))
  const fileName = formatSegment(path.basename(testFilePath))
  const dirName = [parentName, fileName].filter(Boolean).join('-') || 'pact'
  return path.join(pactGeneratedDir, dirName)
}

export const withPactDir = (testFileUrl, overrides = {}) => ({
  logLevel: process.env.CI ? 'info' : 'debug',
  dir: resolvePactDirectory(testFileUrl),
  pactfileWriteMode: 'update',
  ...overrides
})
