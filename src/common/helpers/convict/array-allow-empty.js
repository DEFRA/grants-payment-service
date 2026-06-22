export const convictArrayAllowEmpty = {
  name: 'array-allow-empty',
  validate: function (val) {
    if (!Array.isArray(val)) {
      throw new TypeError('must be an array')
    }
  },
  coerce: function (val) {
    if (typeof val === 'string' && val === '[]') {
      return []
    }
    if (Array.isArray(val)) {
      return val
    }
    if (typeof val === 'string') {
      return val.split(',').map((v) => v.trim())
    }
    return val
  }
}
