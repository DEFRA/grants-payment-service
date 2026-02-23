import { loadEnvFile } from 'node:process'

import convict from 'convict'
import convictFormatWithValidator from 'convict-format-with-validator'

import { convictValidateMongoUri } from '#~/common/helpers/convict/validate-mongo-uri.js'

try {
  loadEnvFile()
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error
  }
}

convict.addFormat(convictValidateMongoUri)
convict.addFormats(convictFormatWithValidator)

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind',
    format: 'port',
    default: 3001,
    env: 'PORT'
  },
  serviceName: {
    doc: 'Api Service Name',
    format: String,
    default: 'grants-payment-service'
  },
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in. With the addition of "local" for local development',
    format: [
      'local',
      'infra-dev',
      'management',
      'dev',
      'test',
      'perf-test',
      'ext-test',
      'prod'
    ],
    default: 'local',
    env: 'ENVIRONMENT'
  },
  log: {
    isEnabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: !isTest,
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : ['req', 'res', 'responseTime']
    }
  },
  mongo: {
    uri: {
      doc: 'URI for mongodb',
      format: String,
      default: 'mongodb://127.0.0.1:27017/',
      env: 'MONGO_URI'
    },
    database: {
      doc: 'database for mongodb',
      format: String,
      default: 'grants-payment-service',
      env: 'MONGO_DATABASE'
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy URL',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  tracing: {
    header: {
      doc: 'CDP tracing header name',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  paymentHub: {
    uri: {
      doc: 'URI for payment hub service bus',
      format: String,
      default: 'https://paymenthub/',
      env: 'PAYMENT_HUB_URI'
    },
    ttl: {
      doc: 'Time to live for payment hub access token',
      format: 'nat',
      default: 86400,
      env: 'PAYMENT_HUB_TTL'
    },
    keyName: {
      doc: 'Key name for payment hub service bus',
      format: String,
      default: 'MyManagedAccessKey',
      env: 'PAYMENT_HUB_SA_KEY_NAME'
    },
    key: {
      doc: 'Key for payment hub service bus',
      format: String,
      default: 'my_key',
      sensitive: true,
      env: 'PAYMENT_HUB_SA_KEY'
    }
  },
  featureFlags: {
    testEndpoints: {
      doc: 'Enable test endpoints',
      format: 'Boolean',
      default: false,
      env: 'ENABLE_TEST_ENDPOINTS'
    },
    isPaymentHubEnabled: {
      doc: 'Enable or Disable payments hub',
      format: 'Boolean',
      default: false,
      env: 'ENABLE_PAYMENT_HUB'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }
