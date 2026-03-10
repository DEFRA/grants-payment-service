import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const pactOutputDir = path.resolve(
  'src',
  'contracts',
  'consumer',
  'pacts'
)
export const pactGeneratedDir = path.join(pactOutputDir, 'generated')

const stripExtension = (filename) =>
  filename.replace(/(\.contract)?\.test\.js$/i, '').replace(/\.js$/i, '')

const formatSegment = (value) =>
  stripExtension(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const resolvePactDirectory = (testFileUrl) => {
  const testFilePath = fileURLToPath(testFileUrl)
  const parentName = formatSegment(path.basename(path.dirname(testFilePath)))
  const fileName = formatSegment(path.basename(testFilePath))
  const dirName = [parentName, fileName].filter(Boolean).join('-') || 'pact'
  return path.join(pactGeneratedDir, dirName)
}

export const withPactDir = (testFileUrl, overrides = {}) => ({
  dir: resolvePactDirectory(testFileUrl),
  pactfileWriteMode: 'update',
  ...overrides
})

export const getJsonPacts = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return getJsonPacts(entryPath)
    }
    return entry.name.endsWith('.json') ? [entryPath] : []
  })
