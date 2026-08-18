// A relative default ('.') rather than an absolute '/calculate' matters here:
// this app can be deployed at its own root or proxied under a path prefix
// (e.g. eamoncobb.com/investmentplanner/). A relative fetch resolves against
// the current page path either way; a root-absolute one would call
// eamoncobb.com/calculate and miss the prefix entirely when proxied.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '.')

export async function calculateGrowth(payload, signal) {
  const res = await fetch(`${API_URL}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok) {
    throw new Error('Could not reach the projection service.')
  }

  return res.json()
}
