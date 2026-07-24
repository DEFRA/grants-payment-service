import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mockConfigGet = vi.hoisted(() =>
  vi.fn((key) => {
    const configMap = {
      cdpEnvironment: 'test',
      serviceName: 'grants-payment-service',
      'aws.region': 'eu-west-2',
      'sns.endpoint': 'http://localhost:4566',
      'sns.auditTopicArn':
        'arn:aws:sns:eu-west-2:000000000000:fcp_audit_grants_payment_service'
    }
    return configMap[key]
  })
)

const mockGetLocalIp = vi.hoisted(() => vi.fn())

vi.mock('#~/config/index.js', () => ({ config: { get: mockConfigGet } }))

vi.mock('#~/common/helpers/request-ip.js', () => ({
  getLocalIp: mockGetLocalIp
}))

describe('AuditEvent', () => {
  let AuditEvent

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('@aws-sdk/client-sns', () => ({
      SNSClient: vi.fn().mockImplementation(function () {
        this.send = vi.fn().mockResolvedValue({})
      }),
      PublishCommand: vi.fn().mockImplementation(function (input) {
        this.input = input
      })
    }))
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
    expect(AuditEvent.GRANT_PAYMENT_CREATED).toBe('GRANT_PAYMENT_CREATED')
    expect(AuditEvent.GRANT_PAYMENT_CANCELLED).toBe('GRANT_PAYMENT_CANCELLED')
    expect(AuditEvent.GRANT_PAYMENT_STALE_LOCK_FAILED).toBe(
      'GRANT_PAYMENT_STALE_LOCK_FAILED'
    )
    expect(AuditEvent.GRANT_PAYMENTS_RESET_TO_PENDING).toBe(
      'GRANT_PAYMENTS_RESET_TO_PENDING'
    )
  })

  test('cannot be mutated', () => {
    expect(() => {
      AuditEvent.NEW_KEY = 'value'
    }).toThrow(TypeError)
    expect(AuditEvent.NEW_KEY).toBeUndefined()
  })
})

describe('auditEvent - PAYMENT_HUB_REQUEST_SENT', () => {
  let auditEvent
  let AuditEvent
  let mockSend
  let SNSClient
  let PublishCommand

  beforeEach(async () => {
    vi.resetModules()
    mockSend = vi.fn().mockResolvedValue({})
    mockGetLocalIp.mockReturnValue('192.168.1.100')
    vi.doMock('@aws-sdk/client-sns', () => ({
      SNSClient: vi.fn().mockImplementation(function () {
        this.send = mockSend
      }),
      PublishCommand: vi.fn().mockImplementation(function (input) {
        this.input = input
      })
    }))
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
    ;({ SNSClient, PublishCommand } = await import('@aws-sdk/client-sns'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  const getPublishedPayload = () => {
    const [publishCommandInstance] = mockSend.mock.calls[0]
    return JSON.parse(publishCommandInstance.input.Message)
  }

  test('creates SNSClient with correct region and endpoint', async () => {
    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})

    expect(SNSClient).toHaveBeenCalledWith({
      region: 'eu-west-2',
      endpoint: 'http://localhost:4566'
    })
  })

  test('publishes to the correct topic ARN', async () => {
    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})

    expect(PublishCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        TopicArn:
          'arn:aws:sns:eu-west-2:000000000000:fcp_audit_grants_payment_service'
      })
    )
  })

  test('publishes correct top-level fields', async () => {
    const context = {
      correlationId: 'corr-xyz',
      contractNumber: 'C12345',
      invoiceNumber: 'INV-001',
      sbi: 123456789,
      frn: 1234567890,
      agreementNumber: 'AGR-001'
    }

    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, context)

    expect(getPublishedPayload()).toMatchObject({
      correlationid: 'corr-xyz',
      datetime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      environment: 'cdp-test',
      application: 'Grants',
      component: 'grants-payment-service'
    })
  })

  test('publishes correct security fields', async () => {
    const context = {
      contractNumber: 'C12345',
      sbi: 123456789,
      frn: 1234567890
    }

    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, context)

    expect(getPublishedPayload().security).toMatchObject({
      pmccode: '0706',
      priority: '0',
      details: {
        transactioncode: '2310',
        message: 'Payment request sent to payment hub',
        additionalinfo:
          'contractNumber: C12345, sbi: 123456789, frn: 1234567890'
      }
    })
  })

  test('publishes correct audit fields', async () => {
    const context = {
      correlationId: 'corr-xyz',
      contractNumber: 'C12345',
      invoiceNumber: 'INV-001',
      agreementNumber: 'AGR-001',
      identifiers: { sbi: 123456789, frn: 1234567890, crn: 'CRN-001' }
    }

    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, context)

    expect(getPublishedPayload().audit).toMatchObject({
      eventtype: 'GrantsPaymentHubRequest',
      entities: [
        { entity: 'payment', action: 'submitted', entityId: 'INV-001' }
      ],
      status: 'success',
      details: context,
      accounts: { sbi: 123456789, frn: 1234567890, crn: 'CRN-001' }
    })
  })

  test('publishes correct audit.accounts fields', async () => {
    const context = {
      identifiers: { sbi: 123456789, frn: 1234567890, crn: 'CRN-001' }
    }

    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, context)

    expect(getPublishedPayload().audit.accounts).toEqual({
      sbi: 123456789,
      frn: 1234567890,
      crn: 'CRN-001'
    })
  })

  test('audit.accounts populates only known fields', async () => {
    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {
      identifiers: { sbi: 111111111 }
    })

    expect(getPublishedPayload().audit.accounts).toEqual({
      sbi: 111111111,
      frn: undefined,
      crn: undefined
    })
  })

  test('audit.entities contains valid action values', async () => {
    const validActions = [
      'created',
      'read',
      'updated',
      'deleted',
      'submitted',
      'accepted',
      'rejected',
      'withdrawn',
      'cancelled'
    ]

    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})

    for (const entry of getPublishedPayload().audit.entities) {
      expect(validActions).toContain(entry.action)
    }
  })

  test('audit.entities contains a payment entity', async () => {
    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})

    expect(
      getPublishedPayload().audit.entities.some((e) => e.entity === 'payment')
    ).toBe(true)
  })

  test('ip is populated from getLocalIp(request)', async () => {
    mockGetLocalIp.mockReturnValue('10.0.0.5')
    const mockRequest = { server: { info: { host: '10.0.0.5' } } }

    await auditEvent(
      AuditEvent.PAYMENT_HUB_REQUEST_SENT,
      {},
      'success',
      mockRequest
    )

    expect(mockGetLocalIp).toHaveBeenCalledWith(mockRequest)
    expect(getPublishedPayload().ip).toBe('10.0.0.5')
  })

  test('ip is populated from getLocalIp(null) when no request is available', async () => {
    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})

    expect(mockGetLocalIp).toHaveBeenCalledWith(null)
    expect(getPublishedPayload().ip).toBe('192.168.1.100')
  })

  test('passes failure status through to the published payload', async () => {
    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {}, 'failure')

    expect(getPublishedPayload().audit.status).toBe('failure')
  })

  test('handles empty context gracefully', async () => {
    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT)

    const payload = getPublishedPayload()
    expect(payload.correlationid).toBeUndefined()
    expect(payload.audit.entities).toEqual([
      { entity: 'payment', action: 'submitted', entityId: undefined }
    ])
  })

  test('defaults status to success when not provided', async () => {
    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {
      invoiceNumber: 'INV-001'
    })

    expect(getPublishedPayload().audit.status).toBe('success')
  })

  test('message is valid JSON', async () => {
    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})

    const [publishCommandInstance] = mockSend.mock.calls[0]
    expect(() => JSON.parse(publishCommandInstance.input.Message)).not.toThrow()
  })
})

describe.each([
  {
    eventKey: 'GRANT_PAYMENT_CREATED',
    eventtype: 'GrantsPaymentCreated',
    action: 'created'
  },
  {
    eventKey: 'GRANT_PAYMENT_CANCELLED',
    eventtype: 'GrantsPaymentCancelled',
    action: 'cancelled'
  },
  {
    eventKey: 'GRANT_PAYMENT_STALE_LOCK_FAILED',
    eventtype: 'GrantsPaymentStaleLockFailed',
    action: 'updated'
  },
  {
    eventKey: 'GRANT_PAYMENTS_RESET_TO_PENDING',
    eventtype: 'GrantsPaymentsResetToPending',
    action: 'updated'
  }
])('auditEvent - $eventKey', ({ eventKey, eventtype, action }) => {
  let auditEvent
  let AuditEvent
  let mockSend

  beforeEach(async () => {
    vi.resetModules()
    mockSend = vi.fn().mockResolvedValue({})
    mockGetLocalIp.mockReturnValue('192.168.1.100')
    vi.doMock('@aws-sdk/client-sns', () => ({
      SNSClient: vi.fn().mockImplementation(function () {
        this.send = mockSend
      }),
      PublishCommand: vi.fn().mockImplementation(function (input) {
        this.input = input
      })
    }))
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  const getPublishedPayload = () => {
    const [publishCommandInstance] = mockSend.mock.calls[0]
    return JSON.parse(publishCommandInstance.input.Message)
  }

  test('publishes correct eventtype and entity action', async () => {
    const context = {
      correlationId: 'corr-xyz',
      sbi: 123456789,
      frn: 1234567890,
      identifiers: { sbi: 123456789, frn: 1234567890, crn: 'CRN-001' }
    }

    await auditEvent(AuditEvent[eventKey], context)

    expect(getPublishedPayload().audit).toMatchObject({
      eventtype,
      entities: [{ entity: 'payment', action, entityId: 'corr-xyz' }],
      status: 'success',
      accounts: { sbi: 123456789, frn: 1234567890, crn: 'CRN-001' }
    })
  })

  test('audit.entities action is part of the allowed vocabulary', async () => {
    const validActions = [
      'created',
      'read',
      'updated',
      'deleted',
      'submitted',
      'accepted',
      'rejected',
      'withdrawn',
      'cancelled'
    ]

    await auditEvent(AuditEvent[eventKey], {})

    for (const entry of getPublishedPayload().audit.entities) {
      expect(validActions).toContain(entry.action)
    }
  })
})

describe('auditEvent error handling', () => {
  let auditEvent
  let AuditEvent
  let mockSend
  let mockLogger

  beforeEach(async () => {
    vi.resetModules()
    mockSend = vi.fn()
    mockLogger = { warn: vi.fn() }
    mockGetLocalIp.mockReturnValue('192.168.1.100')

    const mockGetLogger = vi.fn(() => mockLogger)

    vi.doMock('@aws-sdk/client-sns', () => ({
      SNSClient: vi.fn().mockImplementation(function () {
        this.send = mockSend
      }),
      PublishCommand: vi.fn().mockImplementation(function (input) {
        this.input = input
      })
    }))

    vi.doMock('#~/common/helpers/logging/logger.js', () => ({
      getLogger: mockGetLogger
    }))
    ;({ auditEvent, AuditEvent } = await import('./audit-event.js'))
  })

  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('logs warning when SNS publish fails', async () => {
    const testError = new Error('SNS publish failed')
    mockSend.mockRejectedValue(testError)

    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})

    expect(mockLogger.warn).toHaveBeenCalledWith(
      testError,
      `Failed to publish audit event: ${AuditEvent.PAYMENT_HUB_REQUEST_SENT}, context: ${JSON.stringify({})}`
    )
  })

  test('does not throw when SNS publish fails', async () => {
    mockSend.mockRejectedValue(new Error('SNS publish failed'))

    await expect(
      auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})
    ).resolves.not.toThrow()
  })

  test('handles AWS SDK errors gracefully', async () => {
    const awsError = new Error('AccessDenied')
    awsError.code = 'AccessDenied'
    mockSend.mockRejectedValue(awsError)

    await auditEvent(AuditEvent.PAYMENT_HUB_REQUEST_SENT, {})

    expect(mockLogger.warn).toHaveBeenCalledWith(
      awsError,
      `Failed to publish audit event: ${AuditEvent.PAYMENT_HUB_REQUEST_SENT}, context: ${JSON.stringify({})}`
    )
  })
})
