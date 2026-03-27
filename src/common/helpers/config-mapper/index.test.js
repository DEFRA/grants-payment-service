import { getActionCodeByName, getPaymentHubConfig } from './index.js'

describe('config-mapper', () => {
  describe('getActionCodeByName', () => {
    it.each([
      ['CMOR1', '84011'],
      ['UPL1', '84021'],
      ['UPL2', '84023'],
      ['UPL3', '84025'],
      ['UNKNOWN', undefined]
    ])('given name %s it returns code %s', (name, expectedCode) => {
      expect(getActionCodeByName(name)).toBe(expectedCode)
    })
  })

  describe('getPaymentHubConfig', () => {
    it('returns config for SFI', () => {
      expect(getPaymentHubConfig('SFI')).toEqual({
        accountCode: 'AC001',
        fundCode: 'FUND10',
        ledger: 'AP',
        deliveryBody: 'RP00',
        fesCode: 'FALS_FPTT'
      })
    })

    it('returns config for WMP', () => {
      expect(getPaymentHubConfig('WMP')).toEqual({
        accountCode: 'AC002',
        fundCode: 'FUND20',
        ledger: 'BP',
        deliveryBody: 'RP00',
        fesCode: 'FALS_FPTT'
      })
    })

    it('returns undefined for unknown scheme', () => {
      expect(getPaymentHubConfig('UNKNOWN')).toBeUndefined()
    })
  })
})
