import { networkInterfaces } from 'node:os'

import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { config } from '#~/config/index.js'

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
  PAYMENT_HUB_REQUEST_SENT: 'PAYMENT_HUB_REQUEST_SENT'
})

// Human-readable description for each audit event, used in security.details.message
const eventMessages = {
  [AuditEvent.PAYMENT_HUB_REQUEST_SENT]: 'Payment request sent to payment hub'
}

// Transaction code for each audit event, used in security.details.transactioncode
const eventTransactionCodes = {
  [AuditEvent.PAYMENT_HUB_REQUEST_SENT]: '2310'
}

// PMC code for each audit event, used in security.pmccode
const eventPmcCodes = {
  [AuditEvent.PAYMENT_HUB_REQUEST_SENT]: '0706' // Consider all actions an internal or external user can execute, for example the menu options available to them
}

// Audit event type for each audit event, used in audit.eventtype
const eventTypes = {
  [AuditEvent.PAYMENT_HUB_REQUEST_SENT]: 'GrantsPaymentHubRequest'
}

// Entities for each audit event, used in audit.entities
// action must be one of: created, read, updated, deleted, submitted, accepted, rejected, withdrawn
const eventEntities = {
  [AuditEvent.PAYMENT_HUB_REQUEST_SENT]: (context) => [
    { entity: 'payment', action: 'submitted', id: context.invoiceNumber }
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
  environment: config.get('cdpEnvironment'),
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
  const client = new SNSClient({
    region: config.get('aws.region'),
    endpoint: config.get('sns.endpoint')
  })

  await client.send(
    new PublishCommand({
      TopicArn: config.get('sns.auditTopicArn'),
      Message: JSON.stringify(
        buildAuditPayload(event, context, status, request)
      )
    })
  )
}
