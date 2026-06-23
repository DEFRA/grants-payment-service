import { describe, it, expect } from 'vitest'
import { prepareWithPaymentHubConfig } from './prepare-with-payment-hub-config.js'

describe('prepareWithPaymentHubConfig', () => {
  it('should return grantPayment with schemeConfig merged into each grant', () => {
    const grantPayment = {
      sbi: 'SBI123',
      frn: 'FRN456',
      claimId: 'CLAIM-789',
      scheme: 'SFI',
      grants: [
        {
          sourceSystem: 'FPTT',
          paymentRequestNumber: 1,
          correlationId: 'CORR-ID-001',
          invoiceNumber: 'ORIG-INV-123',
          originalInvoiceNumber: 'ORIG-INV-123',
          agreementNumber: 'FPTT123456',
          totalAmount: 10000,
          currency: 'GBP',
          marketingYear: 2026,
          accountCode: 'SOS710',
          fundCode: 'DRD10',
          payments: [
            {
              dueDate: '2024-05-01',
              totalAmount: 10000,
              // status: 'pending',
              invoiceLines: [
                {
                  amount: 6000,
                  description:
                    '2024-05-01: Parcel: P1: Parcel Item Description',
                  schemeCode: 'CODE-P1'
                }
              ]
            }
          ]
        }
      ]
    }

    const result = prepareWithPaymentHubConfig(grantPayment)
    const grant = result.grants[0]

    expect(result.scheme).toBe('SFI')
    expect(grant.ledger).toBe('AP') // from SFI config
    expect(grant.fesCode).toBe('FALS_FPTT') // from SFI config

    // Should NOT be at grant level
    expect(grant.accountCode).not.toBe('AC001')
    expect(grant.fundCode).not.toBe('FUND10')
    expect(grant.deliveryBody).toBe('RP00')

    // Should be at invoiceLines level
    grant.payments.forEach((payment) => {
      expect(payment.status).toBe('pending')
      payment.invoiceLines.forEach((invoiceLine) => {
        expect(invoiceLine.accountCode).toBe('SOS710')
        expect(invoiceLine.fundCode).toBe('DRD10')
        expect(invoiceLine.deliveryBody).toBe('RP00')
      })
    })
    // Check original grant properties are preserved
    expect(grant.sourceSystem).toBe('FPTT')
    expect(grant.correlationId).toBe('CORR-ID-001')
  })

  it('should return original grantPayment if scheme config is not found', () => {
    const grantPayment = {
      scheme: 'NON_EXISTENT',
      grants: [{ original: 'prop' }]
    }

    const result = prepareWithPaymentHubConfig(grantPayment)

    expect(result).toEqual(grantPayment)
  })

  it('should handle missing grants array', () => {
    const grantPayment = {
      scheme: 'SFI'
    }

    const result = prepareWithPaymentHubConfig(grantPayment)

    expect(result.grants).toEqual([])
  })

  it('should handle missing payments and invoiceLines in grants', () => {
    const grantPayment = {
      scheme: 'SFI',
      grants: [
        {
          sourceSystem: 'TEST'
          // no payments
        }
      ]
    }

    const result = prepareWithPaymentHubConfig(grantPayment)
    expect(result.grants[0].payments).toEqual([])
  })

  it('should handle missing invoiceLines in payments', () => {
    const grantPayment = {
      scheme: 'SFI',
      grants: [
        {
          sourceSystem: 'TEST',
          payments: [
            {
              dueDate: '2026-01-01'
              // no invoiceLines
            }
          ]
        }
      ]
    }

    const result = prepareWithPaymentHubConfig(grantPayment)
    expect(result.grants[0].payments[0].invoiceLines).toEqual([])
  })

  it('should return grantPayment with WMP schemeConfig merged into each grant', () => {
    const grantPayment = {
      sbi: 'SBI123',
      frn: 'FRN456',
      claimId: 'CLAIM-789',
      scheme: 'WMP',
      grants: [
        {
          paymentRequestNumber: 1,
          correlationId: 'CORR-ID-001',
          invoiceNumber: 'WMP-INV-123',
          originalInvoiceNumber: 'WMP-INV-123',
          agreementNumber: 'WMP123456',
          totalAmount: 15000,
          currency: 'GBP',
          marketingYear: 2026,
          payments: [
            {
              dueDate: '2024-06-01',
              totalAmount: 15000,
              invoiceLines: [
                {
                  amount: 15000,
                  description: 'Test Payment'
                }
              ]
            }
          ]
        }
      ]
    }

    const result = prepareWithPaymentHubConfig(grantPayment)
    const grant = result.grants[0]

    // From WMP config
    expect(grant.sourceSystem).toBe('WMP')
    expect(grant.ledger).toBe('AP')
    expect(grant.fesCode).toBe('FALS_WMP')
    expect(grant.deliveryBody).toBe('RP10')
    expect(grant.remittanceDescription).toBe('Woodland Management Plan Payment')

    // Should be at invoiceLines level
    grant.payments.forEach((payment) => {
      expect(payment.status).toBe('pending')
      payment.invoiceLines.forEach((invoiceLine) => {
        expect(invoiceLine.accountCode).toBe('SOS710')
        expect(invoiceLine.fundCode).toBe('DRD10')
        expect(invoiceLine.deliveryBody).toBe('RP10')
      })
    })
    // Check original grant properties are preserved
    expect(grant.sourceSystem).toBe('WMP')
    expect(grant.correlationId).toBe('CORR-ID-001')
  })

  it('should allow incoming grantPayment to overwrite schemeConfig values', () => {
    const grantPayment = {
      sbi: 'SBI123',
      scheme: 'WMP',
      grants: [
        {
          sourceSystem: 'CUSTOM_SOURCE_SYSTEM', // should override schemeConfig
          ledger: 'CUSTOM_LEDGER', // should override schemeConfig
          fesCode: 'CUSTOM_FES', // should override schemeConfig
          deliveryBody: 'CUSTOM_BODY', // should override schemeConfig
          remittanceDescription: 'CUSTOM_REMITTANCE',
          payments: [
            {
              dueDate: '2024-05-01',
              totalAmount: 10000,
              invoiceLines: [
                {
                  schemeCode: 'CUSTOM_SCHEME',
                  amount: 6000,
                  description: 'Test line',
                  accountCode: 'CUSTOM_ACCOUNT', // should override schemeConfig
                  fundCode: 'CUSTOM_FUND', // should override schemeConfig
                  deliveryBody: 'CUSTOM_LINE_BODY' // should override schemeConfig
                }
              ]
            }
          ]
        }
      ]
    }

    const result = prepareWithPaymentHubConfig(grantPayment)
    const grant = result.grants[0]

    // Grant level - incoming values should override schemeConfig
    expect(grant.sourceSystem).toBe('CUSTOM_SOURCE_SYSTEM')
    expect(grant.ledger).toBe('CUSTOM_LEDGER')
    expect(grant.fesCode).toBe('CUSTOM_FES')
    expect(grant.deliveryBody).toBe('CUSTOM_BODY')
    expect(grant.remittanceDescription).toBe('CUSTOM_REMITTANCE')

    // InvoiceLine level - incoming values should override schemeConfig
    grant.payments.forEach((payment) => {
      payment.invoiceLines.forEach((invoiceLine) => {
        expect(invoiceLine.schemeCode).toBe('CUSTOM_SCHEME')
        expect(invoiceLine.accountCode).toBe('CUSTOM_ACCOUNT')
        expect(invoiceLine.fundCode).toBe('CUSTOM_FUND')
        expect(invoiceLine.deliveryBody).toBe('CUSTOM_LINE_BODY')
      })
    })
  })
})
