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
    }
  ]
}

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

export const getActionCodeByName = (name) => {
  const action = actions.items.find((item) => item.name === name)
  return action?.code
}
