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

const FLOCI_ENDPOINT = 'http://localhost:4566'

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
    default: 3009,
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
  fetchTimeout: {
    doc: 'Fetch timeout in milliseconds',
    format: Number,
    default: 30000,
    env: 'FETCH_TIMEOUT'
  },
  tracing: {
    header: {
      doc: 'CDP tracing header name',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  lockedPaymentTtl: {
    doc: 'Time in milliseconds before a locked payment is considered stale and marked as failed',
    format: 'nat',
    default: 300000,
    env: 'LOCKED_PAYMENT_TTL'
  },
  cron: {
    timezone: {
      doc: 'Timezone for cron jobs',
      format: String,
      default: 'UTC',
      env: 'CRON_TIMEZONE'
    },
    dailyPaymentSchedule: {
      doc: 'Cron time/schedule for daily payment processing',
      format: String,
      default: '10 0 * * *',
      env: 'CRON_DAILY_PAYMENT_SCHEDULE'
    },
    staleLockedPaymentCleanupSchedule: {
      doc: 'Cron time/schedule for stale locked payment cleanup',
      format: String,
      default: '20 0 * * *',
      env: 'CRON_STALE_LOCKED_PAYMENT_CLEANUP_SCHEDULE'
    },
    statsSchedule: {
      doc: 'Cron time/schedule for outputting stats',
      format: String,
      default: '0 7 * * *',
      env: 'CRON_STATS_SCHEDULE'
    }
  },
  dataMigration: {
    dueDate: {
      doc: 'Due date string used by data migration (YYYY-MM-DD)',
      format: String,
      default: '2026-05-15',
      env: 'DATA_MIGRATION_DUE_DATE'
    }
  },
  paymentProcessor: {
    minBatchSize: {
      doc: 'Minimum number of payments to process in a single batch',
      format: 'nat',
      default: 10,
      env: 'PAYMENT_PROCESSOR_MIN_BATCH_SIZE'
    },
    maxBatchSize: {
      doc: 'Maximum number of payments to process in a single batch',
      format: 'nat',
      default: 100,
      env: 'PAYMENT_PROCESSOR_MAX_BATCH_SIZE'
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
    },
    enableBackups: {
      doc: 'Enable MongoDB backups',
      format: 'Boolean',
      default: false,
      env: 'ENABLE_BACKUPS'
    }
  },
  backup: {
    retentionDays: {
      doc: 'Number of days to keep MongoDB backup collections',
      format: 'nat',
      default: 90,
      env: 'BACKUP_RETENTION_DAYS'
    },
    restoreTimestamp: {
      doc: 'Timestamp of the backup to restore in YYYY-MM-DD-HH-MM-SS format',
      format: String,
      nullable: true,
      default: null,
      env: 'BACKUP_RESTORE_TIMESTAMP'
    }
  },
  paginationLimit: {
    doc: 'Max number of items per page for paginated queries',
    format: 'nat',
    default: 10,
    env: 'PAGE_LIMIT'
  },
  aws: {
    region: {
      doc: 'AWS region',
      format: String,
      default: 'eu-west-2',
      env: 'AWS_REGION'
    }
  },
  sns: {
    endpoint: {
      doc: 'AWS SNS endpoint (local/dev only; in CDP this is typically not required)',
      format: String,
      default: FLOCI_ENDPOINT,
      env: 'SNS_ENDPOINT'
    },
    auditTopicArn: {
      doc: 'SNS topic ARN for audit events (fcp_audit_grants_payment_service)',
      format: String,
      default:
        'arn:aws:sns:eu-west-2:000000000000:fcp_audit_grants_payment_service',
      env: 'SNS_TOPIC_ARN_AUDIT'
    }
  },
  sqs: {
    endpoint: {
      doc: 'AWS SQS endpoint (local/dev only; in CDP this is typically not required)',
      format: String,
      default: FLOCI_ENDPOINT,
      env: 'SQS_ENDPOINT'
    },
    queueUrl: {
      doc: 'Inbound SQS queue URL (e.g. gps__sqs__create_payment)',
      format: String,
      default:
        'http://localhost:4566/000000000000/gps__sqs__create_payment.fifo',
      env: 'QUEUE_URL'
    },
    cancelPaymentQueueUrl: {
      doc: 'Inbound SQS queue URL (e.g. gps__sqs__cancel_payment)',
      format: String,
      default:
        'http://localhost:4566/000000000000/gps__sqs__cancel_payment.fifo',
      env: 'CANCEL_PAYMENT_QUEUE_URL'
    },
    maxMessages: {
      doc: 'Max number of messages to receive from SQS per poll',
      format: 'nat',
      default: 1,
      env: 'MAX_NUMBER_OF_MESSAGES'
    },
    visibilityTimeout: {
      doc: 'Visibility timeout for SQS messages (seconds)',
      format: 'nat',
      default: 60,
      env: 'VISIBILITY_TIMEOUT'
    },
    waitTime: {
      doc: 'Long polling wait time for SQS messages (seconds)',
      format: 'nat',
      default: 20,
      env: 'WAIT_TIME_SECONDS'
    },
    messageDeduplicationEnabled: {
      doc: 'Skip SQS messages already recorded in processed_sqs_messages (by queue tag and MessageId)',
      format: Boolean,
      default: true,
      env: 'SQS_MESSAGE_DEDUPLICATION_ENABLED'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }
