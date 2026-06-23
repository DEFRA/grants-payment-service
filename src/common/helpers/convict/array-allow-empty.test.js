import { convictArrayAllowEmpty } from '#~/common/helpers/convict/array-allow-empty.js'

describe('#convictArrayAllowEmpty', () => {
  test.each(['', '[]'])('With %j, Should return empty array', (value) => {
    expect(convictArrayAllowEmpty.coerce(value)).toEqual([])
  })

  test('With comma-separated string, Should return array of trimmed values', () => {
    expect(convictArrayAllowEmpty.coerce('PA3,PA4,PA5')).toEqual([
      'PA3',
      'PA4',
      'PA5'
    ])
  })

  test('With comma-separated string with spaces, Should return array of trimmed values', () => {
    expect(convictArrayAllowEmpty.coerce('1, 2,3')).toEqual(['1', '2', '3'])
  })

  test('With array, Should return array as-is', () => {
    expect(convictArrayAllowEmpty.coerce(['PA3', 'PA4'])).toEqual([
      'PA3',
      'PA4'
    ])
  })

  test('With empty array, Should return empty array', () => {
    expect(convictArrayAllowEmpty.coerce([])).toEqual([])
  })

  test('With single value string, Should return array with single value', () => {
    expect(convictArrayAllowEmpty.coerce('PA3')).toEqual(['PA3'])
  })

  test('Validate with array, Should not throw', () => {
    expect(() => convictArrayAllowEmpty.validate(['PA3'])).not.toThrow()
  })

  test('Validate with empty array, Should not throw', () => {
    expect(() => convictArrayAllowEmpty.validate([])).not.toThrow()
  })

  test('Validate with non-array, Should throw TypeError', () => {
    expect(() => convictArrayAllowEmpty.validate('not an array')).toThrow(
      TypeError
    )
  })

  test('Validate with object, Should throw TypeError', () => {
    expect(() => convictArrayAllowEmpty.validate({})).toThrow(TypeError)
  })
})
