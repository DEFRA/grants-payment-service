import { defineConfig, configDefaults } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    // Mirror Node ESM: import file extensions must be fully specified (e.g. "x.js")
    extensions: [],
    alias: {
      '~': __dirname
    }
  },
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        ...configDefaults.exclude,
        '**/__mocks__/*.js',
        '**/*.d.js',
        '**/config/index.js',
        '**/contracts/**',
        '**/sample-data/**',
        '**/test-helpers/**',
        'coverage'
      ]
    },
    setupFiles: ['.vite/mongo-memory-server.js', '.vite/setup-files.js']
  }
})
