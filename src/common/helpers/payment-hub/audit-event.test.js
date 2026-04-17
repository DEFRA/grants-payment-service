import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mockConfigGet = vi.hoisted(() =>
  vi.fn((key) => {
    const configMap = {
      cdpEnvironment: 'test',
      serviceName: 'grants-payment-service'
    }
    return configMap[key]
  })
)

vi.mock('#~/config/index.js', () => ({ config: { get: mockConfigGet } }))

describe('AuditEvent', () => {
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('@defra/cdp-auditing', () => ({ audit: vi.fn() }))
    ;({ AuditEvent } = await import('./audit-event.js'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('is frozen', () => {
    expect(Object.isFrozen(AuditEvent)).toBe(true)
  })

  test('contains expected event keys', () => {
    expect(AuditEvent.PAYMENT_HUB_REQUEST_SENT).toBe('PAYMENT_HUB_REQUEST_SENT')
  })

  test('cannot be mutated', () => {
    expect(() => {
      AuditEvent.NEW_KEY = 'value'
    }).toThrow(TypeError)
    expect(AuditEvent.NEW_KEY).toBeUndefined()
  })
})

describe('auditEvent - PAYMENT_HUB_REQUEST_SENT', () => {
  let audit
  let auditEvent
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('@defra/cdp-auditing', () => ({ audit: vi.fn() }))
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
    ;({ audit } = await import('@defra/cdp-auditing'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('calls audit with correct top-level fields', () => {
    const context = {
      correlationId: 'corr-xyz',
      contractNumber: 'C12345',
      invoiceNumber: 'INV-001',
      sbi: 123456789,
      frn: 1234567890,
      agreementNumber: 'AGR-001'
    }

    auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, context)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationid: 'corr-xyz',
        datetime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        environment: 'test',
        application: 'Grants',
        component: 'grants-payment-service'
      })
    )
  })

  test('calls audit with correct security fields', () => {
    const context = {
      contractNumber: 'C12345',
      sbi: 123456789,
      frn: 1234567890
    }

    auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, context)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        security: expect.objectContaining({
          pmccode: '0706',
          priority: '0',
          details: expect.objectContaining({
            transactioncode: '2310',
            message: 'Payment request sent to payment hub',
            additionalinfo:
              'contractNumber: C12345, sbi: 123456789, frn: 1234567890'
          })
        })
      })
    )
  })

  test('calls audit with correct audit fields', () => {
    const context = {
      correlationId: 'corr-xyz',
      contractNumber: 'C12345',
      invoiceNumber: 'INV-001',
      sbi: 123456789,
      frn: 1234567890,
      crn: 'CRN-001',
      agreementNumber: 'AGR-001'
    }

    auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, context)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          eventtype: 'GrantsPaymentHubRequest',
          entities: [{ entity: 'payment', action: 'submitted', id: 'INV-001' }],
          status: 'success',
          details: context,
          accounts: { sbi: 123456789, frn: 1234567890, crn: 'CRN-001' }
        })
      })
    )
  })

  test('calls audit with correct audit.accounts fields', () => {
    const context = {
      sbi: 123456789,
      frn: 1234567890,
      crn: 'CRN-001'
    }

    auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, context)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          accounts: { sbi: 123456789, frn: 1234567890, crn: 'CRN-001' }
        })
      })
    )
  })

  test('audit.accounts populates only known fields', () => {
    auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, { sbi: 111111111 })

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          accounts: { sbi: 111111111, frn: undefined, crn: undefined }
        })
      })
    )
  })

  test('audit.entities contains valid action values', () => {
    const validActions = [
      'created',
      'read',
      'updated',
      'deleted',
      'submitted',
      'accepted',
      'rejected',
      'withdrawn'
    ]

    auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})

    const [payload] = audit.mock.calls[0]
    for (const entry of payload.audit.entities) {
      expect(validActions).toContain(entry.action)
    }
  })

  test('audit.entities contains a payment entity', () => {
    auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})

    const [payload] = audit.mock.calls[0]
    expect(payload.audit.entities.some((e) => e.entity === 'payment')).toBe(
      true
    )
  })

  test('passes failure status through to the audit payload', () => {
    auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {}, 'failure')

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({ status: 'failure' })
      })
    )
  })

  test('handles empty context gracefully', () => {
    auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT)

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationid: undefined,
        audit: expect.objectContaining({
          entities: [{ entity: 'payment', action: 'submitted', id: undefined }]
        })
      })
    )
  })

  test('defaults status to success when not provided', () => {
    auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {
      invoiceNumber: 'INV-001'
    })

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({ status: 'success' })
      })
    )
  })
})
