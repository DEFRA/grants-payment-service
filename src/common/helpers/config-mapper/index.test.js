import { getActionCodeByName, getPaymentHubConfig } from './index.js'

describe('config-mapper', () => {
  describe('getActionCodeByName', () => {
    it.each([
      ['CMOR1', '84011'],
      ['UPL1', '84021'],
      ['UPL2', '84023'],
      ['UPL3', '84025'],
      ['PA3', '82555'],
      ['UNKNOWN', undefined]
    ])('given name %s it returns code %s', (name, expectedCode) => {
      expect(getActionCodeByName(name)).toBe(expectedCode)
    })
  })

  describe('getPaymentHubConfig', () => {
    it('returns config for SFI', () => {
      expect(getPaymentHubConfig('SFI')).toEqual({
        accountCode: 'SOS710',
        deliveryBody: 'RP00',
        fesCode: 'FALS_FPTT',
        fundCode: 'DRD10',
        ledger: 'AP',
        remittanceDescription: 'Farm Payments Technical Test Payment',
        sourceSystem: 'FPTT'
      })
    })

    it('returns config for WMP', () => {
      expect(getPaymentHubConfig('WMP')).toEqual({
        accountCode: 'SOS710',
        deliveryBody: 'RP10',
        fesCode: 'FALS_WMP',
        fundCode: 'DRD10',
        ledger: 'AP',
        remittanceDescription: 'Woodland Management Plan Payment',
        sourceSystem: 'WMP'
      })
    })

    it('returns undefined for unknown scheme', () => {
      expect(getPaymentHubConfig('UNKNOWN')).toBeUndefined()
    })
  })
})
