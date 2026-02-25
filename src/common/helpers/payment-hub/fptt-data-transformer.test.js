import { transformFpttPaymentDataToPaymentHubFormat } from './fptt-data-transformer'

describe('transformFpttPaymentDataToPaymentHubFormat', () => {
  const baseIdentifiers = { sbi: '111', frn: '222', claimId: '333' }
  const baseGrant = {
    invoiceNumber: 'INV1',
    marketingYear: '2026',
    paymentRequestNumber: 5,
    agreementNumber: 'AGR1',
    totalAmount: '1000',
    currency: 'GBP',
    originalInvoiceNumber: 'OINV',
    originalSettlementDate: '2026-01-02',
    recoveryDate: '2026-01-03',
    remittanceDescription: 'ignored',
    correlationId: 'CORR'
  }

  it('produces expected shape for a valid payment', () => {
    const payment = {
      dueDate: '2026-06-05',
      recoveryDate: '2026-06-06',
      originalSettlementDate: '2026-06-07',
      currency: 'EUR',
      invoiceLines: [{ schemeCode: 'SC', description: 'D', amount: '12.34' }]
    }

    const result = transformFpttPaymentDataToPaymentHubFormat(
      baseIdentifiers,
      baseGrant,
      payment
    )

    expect(result).toMatchObject({
      sourceSystem: 'FPTT',
      ledger: 'AP',
      deliveryBody: 'RP00',
      invoiceNumber: 'INV1',
      frn: '222',
      sbi: '111',
      fesCode: 'FALS_FPTT',
      marketingYear: '2026',
      paymentRequestNumber: 5,
      agreementNumber: 'AGR1',
      contractNumber: '333',
      currency: 'EUR',
      dueDate: '05/06/2026',
      value: '1000',
      annualValue: '1000',
      remittanceDescription: 'Farm Payments Technical Test Payment',
      debtType: '',
      recoveryDate: '06/06/2026',
      originalInvoiceNumber: 'OINV',
      originalSettlementDate: '07/06/2026',
      schedule: 'T4',
      correlationId: 'CORR'
    })

    expect(result.invoiceLines).toHaveLength(1)
    expect(result.invoiceLines[0]).toMatchObject({
      schemeCode: 'SC',
      description: 'D',
      value: '12.34',
      agreementNumber: 'AGR1',
      marketingYear: '2026'
    })
  })

  it('uses default accountCode/fundCode when not provided in invoice line', () => {
    const payment = {
      dueDate: '2026-06-05',
      invoiceLines: [{ schemeCode: 'SC', description: 'D', amount: '5.00' }]
    }
    const result = transformFpttPaymentDataToPaymentHubFormat(
      baseIdentifiers,
      baseGrant,
      payment
    )
    expect(result.invoiceLines[0].accountCode).toBe('SOS710')
    expect(result.invoiceLines[0].fundCode).toBe('DRD10')
  })

  it('defaults currency to GBP when missing', () => {
    const minimalPayment = { dueDate: '2026-12-01', invoiceLines: [] }
    const out = transformFpttPaymentDataToPaymentHubFormat(
      baseIdentifiers,
      baseGrant,
      minimalPayment
    )
    expect(out.currency).toBe('GBP')
  })

  it('throws when date fields are invalid', () => {
    expect(() =>
      transformFpttPaymentDataToPaymentHubFormat(baseIdentifiers, baseGrant, {
        dueDate: 123,
        invoiceLines: []
      })
    ).toThrow(/Payment date must be a string/)
  })
})
