const offsetDate = (days, date = new Date()) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export const getPreviousDay = (date) => offsetDate(-1, date)

export const getTodaysDate = () => offsetDate(0)

export const getTomorrowsDate = () => offsetDate(1)
