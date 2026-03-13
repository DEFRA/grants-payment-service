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
        correlationId: '7cf9bd11-c791-42c9-bd28-fa0fec_id',
        invoiceNumber: 'R00000004-V001Q2',
        originalInvoiceNumber: '',
        agreementNumber: 'FPTT264870631',
        totalAmountPence: '70285',
        currency: 'GBP',
        marketingYear: '2026',
        payments: [
          {
            dueDate: '2026-06-05',
            totalAmountPence: '1263',
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
