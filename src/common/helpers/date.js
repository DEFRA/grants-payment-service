/**
 * @param {number} days
 * @param {Date | string | undefined} [date]
 * @returns {string}
 */
const offsetDate = (days, date = new Date()) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/**
 * @returns {string}
 */
export const getTodaysDate = () => offsetDate(0)

/**
 * @returns {string}
 */
export const getTomorrowsDate = () => offsetDate(1)

/**
 * @param {string | undefined} date
 * @returns {string}
 */
export const getNextDay = (date) => offsetDate(1, date)
