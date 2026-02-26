/**
 * Formats a YYYY-MM-DD date string into DD/MM/YYYY.
 * @param {string} paymentDate
 * @returns {string}
 */
function formatPaymentDate(paymentDate) {
  if (paymentDate === undefined) {
    return ''
  }

  if (typeof paymentDate !== 'string') {
    throw new Error('Payment date must be a string')
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(paymentDate)
  if (!match) {
    throw new Error('Payment date must be in YYYY-MM-DD format')
  }

  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

export { formatPaymentDate }
