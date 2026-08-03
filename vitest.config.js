import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Mirror Node ESM: import file extensions must be fully specified (e.g. "x.js")
    extensions: []
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
