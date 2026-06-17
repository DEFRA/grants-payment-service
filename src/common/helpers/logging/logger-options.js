import { ecsFormat } from '@elastic/ecs-pino-format'
import { config } from '#~/config/index.js'
import { getTraceId } from '@defra/hapi-tracing'

const logConfig = config.get('log') || {}
const serviceName = config.get('serviceName') || ''
const serviceVersion = config.get('serviceVersion') || ''
const testEndpointsEnabled = config.get('featureFlags.testEndpoints') === true

const formatters = {
  ecs: {
    ...ecsFormat({
      serviceVersion,
      serviceName
    })
  },
  'pino-pretty': { transport: { target: 'pino-pretty' } }
}

export const loggerOptions = {
  enabled: logConfig.isEnabled ?? false,
  ignorePaths: ['/health'],
  redact: {
    paths: testEndpointsEnabled
      ? ['req.headers.x-api-key']
      : logConfig.redact || [],
    remove: !testEndpointsEnabled
  },
  level: logConfig.level || 'info',
  ...formatters[logConfig.format],
  nesting: true,
  logPayload: testEndpointsEnabled,
  mixin() {
    const mixinValues = {}
    const traceId = getTraceId()
    if (traceId) {
      mixinValues.trace = { id: traceId }
    }
    return mixinValues
  }
}
