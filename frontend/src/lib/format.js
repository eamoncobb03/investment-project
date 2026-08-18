const full = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const compact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const money = (n) => full.format(n || 0)
export const moneyCompact = (n) => compact.format(n || 0)

// Keeps only what can form a positive decimal, so the field can never hold
// something the browser or the API would choke on. Empty stays empty rather
// than snapping to 0, otherwise typing over a cleared field appends to it.
export function sanitizeNumeric(raw) {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  return rest.length ? `${whole}.${rest.join('')}` : whole
}

export const toNumber = (raw) => {
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}
