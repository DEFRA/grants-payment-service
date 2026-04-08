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
})
