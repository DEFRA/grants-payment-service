export const convictArrayAllowEmpty = {
  name: 'array-allow-empty',
  validate: function (val) {
    if (!Array.isArray(val)) {
      throw new TypeError('must be an array')
    }
  },
  coerce: function (val) {
    if (typeof val === 'string') {
      if (val === '[]' || val === '') {
        return []
      }
      return val.split(',').map((v) => v.trim())
    }
    if (Array.isArray(val)) {
      return val
    }
    return val
  }
}
