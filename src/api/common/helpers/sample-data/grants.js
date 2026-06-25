export default [
  {
    sbi: '106284736',
    frn: '12544567',
    claimId: 'R00000004',
    scheme: 'SFI',
    grants: [
      {
        sourceSystem: 'FPTT',
        paymentRequestNumber: 1,
        correlationId: 'sfi-grant-correlation-id',
        invoiceNumber: 'R00000004-V001',
        originalInvoiceNumber: '',
        agreementNumber: 'FPTT264870631',
        totalAmountPence: '70285',
        deliveryBody: 'RP00',
        currency: 'GBP',
        marketingYear: '2026',
        ledger: 'AP',
        fesCode: 'FALS_FPTT',
        payments: [
          {
            dueDate: '2026-06-05',
            totalAmountPence: '1263',
            correlationId: 'sfi-payment-correlation-id',
            status: 'pending',
            invoiceLines: [
              {
                schemeCode: 'CMOR1',
                accountCode: 'SOS710',
                fundCode: 'DRD10',
                description:
                  'Parcel 8083 - Assess moorland and produce a written record',
                amountPence: '1263',
                deliveryBody: 'RP00',
                marketingYear: '2026'
              }
            ]
            // status will default to 'pending'
          }
        ]
      }
    ]
  },
  {
    sbi: '123456789',
    frn: '987654321',
    claimId: 'R00000001',
    scheme: 'WMP',
    grants: [
      {
        paymentRequestNumber: 1,
        correlationId: 'wmp-grant-correlation-id',
        invoiceNumber: 'R00000001-V001QX',
        agreementNumber: 'WPM123456789',
        totalAmountPence: '1234',
        currency: 'GBP',
        marketingYear: '2026',
        payments: [
          {
            dueDate: '2026-06-05',
            totalAmountPence: '1234',
            status: 'pending',
            invoiceLines: [
              {
                schemeCode: 'PA3',
                amountPence: '1234',
                description: 'Woodland Management Plan'
              }
            ],
            correlationId: 'wmp-payment-correlation-id'
          }
        ]
      }
    ]
  }
]
