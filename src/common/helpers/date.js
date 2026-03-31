export const now = () => new Date().toISOString()

export const getTodaysDate = () => now().split('T')[0]
