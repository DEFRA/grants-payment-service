const actions = {
  items: [
    {
      name: 'CMOR1',
      code: '84011'
    },
    {
      name: 'UPL1',
      code: '84021'
    },
    {
      name: 'UPL2',
      code: '84023'
    },
    {
      name: 'UPL3',
      code: '84025'
    },
    {
      name: 'PA3', // WMP
      code: '82555'
    }
  ]
}

const schemeConfigMapper = {
  SFI: {
    sourceSystem: 'FPTT', //Farm Payments Technical Test
    ledger: 'AP',
    deliveryBody: 'RP00',
    fesCode: 'FALS_FPTT',
    remittanceDescription: 'Farm Payments Technical Test Payment',
    accountCode: 'SOS710',
    fundCode: 'DRD10'
  },
  WMP: {
    sourceSystem: 'WMP', // Woodland Management Plan
    ledger: 'AP',
    deliveryBody: 'RP10',
    fesCode: 'FALS_WMP',
    remittanceDescription: 'Woodland Management Plan Payment',
    accountCode: 'SOS710',
    fundCode: 'DRD10'
  }
}

export const getPaymentHubConfig = (schemeCode) => {
  return schemeConfigMapper[schemeCode]
}

export const getActionCodeByName = (name) => {
  const action = actions.items.find((item) => item.name === name)
  return action?.code
}
