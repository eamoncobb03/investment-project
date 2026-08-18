import { useEffect, useRef, useState } from 'react'
import { calculateGrowth } from './api'

function validate(years) {
  if (!Number.isFinite(years) || years <= 0) return 'End age must be greater than start age.'
  return null
}

/**
 * Fires whenever the applied params change (the caller decides when that is —
 * e.g. on an explicit "Apply" click rather than every keystroke, to keep API
 * calls infrequent). Every run aborts the previous request and carries a
 * sequence number, so a slow earlier response can never overwrite a newer one.
 *
 * "pending" is derived by comparing the key of the params that produced the
 * current data against the key of what's currently applied, rather than set
 * via setState at the top of the effect — that would force an extra render
 * on every change just to flip a flag true before the real one arrives.
 */
export function useProjection({ initial, monthly, rate, startAge, endAge }) {
  const [state, setState] = useState({ data: null, error: null, key: null })
  const seq = useRef(0)

  const years = endAge - startAge
  const invalid = validate(years)
  const key = JSON.stringify([initial, monthly, rate, startAge, endAge])

  useEffect(() => {
    if (invalid) return

    const controller = new AbortController()
    const id = ++seq.current

    calculateGrowth(
      {
        initial_amount: initial,
        monthly_contribution: monthly,
        annual_rate: rate,
        years,
      },
      controller.signal,
    )
      .then((data) => {
        if (id !== seq.current) return
        setState({
          data: {
            ...data,
            rows: data.yearly_breakdown.map((row) => ({ ...row, age: startAge + row.year })),
          },
          error: null,
          key,
        })
      })
      .catch((err) => {
        if (err.name === 'AbortError' || id !== seq.current) return
        setState({ data: null, error: err.message, key })
      })

    return () => controller.abort()
  }, [initial, monthly, rate, startAge, years, invalid, key])

  if (invalid) return { data: null, error: invalid, pending: false }
  return { data: state.data, error: state.error, pending: state.key !== key }
}
