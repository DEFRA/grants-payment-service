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
        correlationId: 'grant-correlation-id',
        invoiceNumber: 'R00000004-V001Q2',
        originalInvoiceNumber: '',
        agreementNumber: 'FPTT264870631',
        totalAmountPence: '70285',
        deliveryBody: 'RP00',
        currency: 'GBP',
        marketingYear: '2026',
        payments: [
          {
            dueDate: '2026-06-05',
            totalAmountPence: '1263',
            correlationId: 'payment-correlation-id',
            status: 'pending',
            invoiceLines: [
              {
                schemeCode: 'CMOR1',
                description:
                  'Parcel 8083 - Assess moorland and produce a written record',
                amountPence: '1263'
              }
            ]
            // status will default to 'pending'
          }
        ]
      }
    ]
  }
]
