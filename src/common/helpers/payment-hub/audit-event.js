import { networkInterfaces } from 'node:os'

import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { config } from '#~/config/index.js'
import { getLogger } from '#~/common/helpers/logging/logger.js'

const getLocalIp = (request) => {
  const hapiHost = request?.server?.info?.host
  if (hapiHost && hapiHost !== '0.0.0.0') {
    return hapiHost
  }
  for (const iface of Object.values(networkInterfaces())) {
    for (const addr of iface) {
      if (!addr.internal && addr.family === 'IPv4') {
        return addr.address
      }
    }
  }
  return ''
}

/**
 * Audit event types.
 * @enum {string}
 */
export const AuditEvent = Object.freeze({
  PAYMENT_HUB_REQUEST_SENT: 'PAYMENT_HUB_REQUEST_SENT',
  GRANT_PAYMENT_CREATED: 'GRANT_PAYMENT_CREATED',
  GRANT_PAYMENT_CANCELLED: 'GRANT_PAYMENT_CANCELLED',
  GRANT_PAYMENT_STALE_LOCK_FAILED: 'GRANT_PAYMENT_STALE_LOCK_FAILED',
  GRANT_PAYMENTS_RESET_TO_PENDING: 'GRANT_PAYMENTS_RESET_TO_PENDING'
})

// Human-readable description for each audit event, used in security.details.message
const eventMessages = {
  [AuditEvent.PAYMENT_HUB_REQUEST_SENT]: 'Payment request sent to payment hub',
  [AuditEvent.GRANT_PAYMENT_CREATED]: 'Grant payment created',
  [AuditEvent.GRANT_PAYMENT_CANCELLED]: 'Grant payment cancelled',
  [AuditEvent.GRANT_PAYMENT_STALE_LOCK_FAILED]:
    'Grant payment failed due to stale lock timeout',
  [AuditEvent.GRANT_PAYMENTS_RESET_TO_PENDING]:
    'Failed grant payment reset to pending'
}

// Transaction code for each audit event, used in security.details.transactioncode
const eventTransactionCodes = {
  [AuditEvent.PAYMENT_HUB_REQUEST_SENT]: '2310',
  [AuditEvent.GRANT_PAYMENT_CREATED]: '2314',
  [AuditEvent.GRANT_PAYMENT_CANCELLED]: '2315',
  [AuditEvent.GRANT_PAYMENT_STALE_LOCK_FAILED]: '2316',
  [AuditEvent.GRANT_PAYMENTS_RESET_TO_PENDING]: '2315'
}

// PMC code for each audit event, used in security.pmccode
const eventPmcCodes = {
  [AuditEvent.PAYMENT_HUB_REQUEST_SENT]: '0706', // Consider all actions an internal or external user/service can execute
  [AuditEvent.GRANT_PAYMENT_CREATED]: '0706',
  [AuditEvent.GRANT_PAYMENT_CANCELLED]: '0706',
  [AuditEvent.GRANT_PAYMENT_STALE_LOCK_FAILED]: '0706',
  [AuditEvent.GRANT_PAYMENTS_RESET_TO_PENDING]: '0706'
}

// Audit event type for each audit event, used in audit.eventtype
const eventTypes = {
  [AuditEvent.PAYMENT_HUB_REQUEST_SENT]: 'GrantsPaymentHubRequest',
  [AuditEvent.GRANT_PAYMENT_CREATED]: 'GrantsPaymentCreated',
  [AuditEvent.GRANT_PAYMENT_CANCELLED]: 'GrantsPaymentCancelled',
  [AuditEvent.GRANT_PAYMENT_STALE_LOCK_FAILED]: 'GrantsPaymentStaleLockFailed',
  [AuditEvent.GRANT_PAYMENTS_RESET_TO_PENDING]: 'GrantsPaymentsResetToPending'
}

// Entities for each audit event, used in audit.entities
// action must be one of: created, read, updated, deleted, submitted, accepted, rejected, withdrawn, cancelled
const eventEntities = {
  [AuditEvent.PAYMENT_HUB_REQUEST_SENT]: (context) => [
    { entity: 'payment', action: 'submitted', entityId: context.invoiceNumber }
  ],
  [AuditEvent.GRANT_PAYMENT_CREATED]: (context) => [
    { entity: 'payment', action: 'created', entityId: context.correlationId }
  ],
  [AuditEvent.GRANT_PAYMENT_CANCELLED]: (context) => [
    { entity: 'payment', action: 'cancelled', entityId: context.correlationId }
  ],
  [AuditEvent.GRANT_PAYMENT_STALE_LOCK_FAILED]: (context) => [
    { entity: 'payment', action: 'updated', entityId: context.correlationId }
  ],
  [AuditEvent.GRANT_PAYMENTS_RESET_TO_PENDING]: (context) => [
    { entity: 'payment', action: 'updated', entityId: context.correlationId }
  ]
}

/**
 * Builds the full audit payload for a payment hub request.
 * @param {AuditEvent} event
 * @param {{ correlationId?: string, contractNumber?: string, invoiceNumber?: string, sbi?: number, frn?: number, crn?: string, agreementNumber?: string }} context
 * @param {'success'|'failure'} status
 * @param {import('@hapi/hapi').Request|null} request
 */
const buildAuditPayload = (
  event,
  context = {},
  status = 'success',
  request = null
) => ({
  correlationid: context.correlationId,
  datetime: new Date().toISOString(),
  environment: `cdp-${config.get('cdpEnvironment')}`,
  version: '0.1.0',
  application: 'Grants',
  component: config.get('serviceName'),
  ip: getLocalIp(request),

  security: {
    pmccode: eventPmcCodes[event],
    priority: '0',
    details: {
      transactioncode: eventTransactionCodes[event],
      message: eventMessages[event],
      additionalinfo: `contractNumber: ${context.contractNumber}, sbi: ${context.sbi}, frn: ${context.frn}`
    }
  },

  audit: {
    eventtype: eventTypes[event],
    entities: eventEntities[event](context),
    status,
    details: context,
    accounts: {
      sbi: context.identifiers?.sbi,
      frn: context.identifiers?.frn,
      crn: context.identifiers?.crn
    }
  }
})

/** @type {import('@aws-sdk/client-sns').SNSClient|null} */
let snsClient = null

const getSnsClient = () => {
  if (!snsClient) {
    snsClient = new SNSClient({
      region: config.get('aws.region'),
      endpoint: config.get('sns.endpoint')
    })
  }
  return snsClient
}

/**
 * Records a payment hub request audit event.
 * @param {AuditEvent} event
 * @param {{ correlationId?: string, contractNumber?: string, invoiceNumber?: string, sbi?: number, frn?: number, crn?: string, agreementNumber?: string }} context
 * @param {'success'|'failure'} [status]
 * @param {import('@hapi/hapi').Request|null} [request]
 */
export const auditEvent = async (
  event,
  context = {},
  status = 'success',
  request = null
) => {
  const logger = getLogger()
  try {
    await getSnsClient().send(
      new PublishCommand({
        TopicArn: config.get('sns.auditTopicArn'),
        Message: JSON.stringify(
          buildAuditPayload(event, context, status, request)
        )
      })
    )
    logger.info(
      `Audit event successfully published: ${event}, context: ${JSON.stringify(context)}`
    )
  } catch (error) {
    logger.warn(
      error,
      `Failed to publish audit event: ${event}, context: ${JSON.stringify(context)}`
    )
  }
}
