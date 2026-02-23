import { tracing } from '@defra/hapi-tracing'
import { index } from '#~/config/index.js'

export const requestTracing = {
  plugin: tracing.plugin,
  options: {
    tracingHeader: index.get('tracing.header')
  }
}
