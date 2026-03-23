import { audit } from '@defra/cdp-auditing'
import { config } from '#~/config/index.js'

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

/**
 * Builds the full audit payload for a payment hub request.
 * @param {AuditEvent} event
 * @param {{ correlationId?: string, contractNumber?: string, invoiceNumber?: string, sbi?: number, frn?: number, agreementNumber?: string }} context
 * @param {'success'|'failure'} status
 */
const buildAuditPayload = (event, context = {}, status = 'success') => ({
  correlationid: context.correlationId,
  datetime: new Date().toISOString(),
  environment: config.get('cdpEnvironment'),
  version: '0.1.0',
  application: 'Grants',
  component: config.get('serviceName'),

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
    action: event,
    entity: 'Payments',
    entityid: context.invoiceNumber,
    status,
    details: context
  }
})

/**
 * Records a payment hub request audit event.
 * @param {AuditEvent} event
 * @param {{ correlationId?: string, contractNumber?: string, invoiceNumber?: string, sbi?: number, frn?: number, agreementNumber?: string }} context
 * @param {'success'|'failure'} [status]
 */
export const auditEvent = (event, context = {}, status = 'success') => {
  audit(buildAuditPayload(event, context, status))
}
