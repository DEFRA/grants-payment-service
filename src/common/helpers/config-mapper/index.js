const schemeConfigMapper = {
  SFI: {
    accountCode: 'AC001',
    fundCode: 'FUND10',
    ledger: 'AP',
    deliveryBody: 'RP00',
    fesCode: 'FALS_FPTT'
  },
  WMP: {
    accountCode: 'AC002',
    fundCode: 'FUND20',
    ledger: 'BP',
    deliveryBody: 'RP00',
    fesCode: 'FALS_FPTT'
  }
}

export const getPaymentHubConfig = (schemeCode) => {
  return schemeConfigMapper[schemeCode]
}
