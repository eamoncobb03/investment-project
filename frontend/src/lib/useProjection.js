import { useMemo } from 'react'
import { calculateGrowth } from './api'
import { useRemote } from './useRemote'

export function validateAges(years) {
  if (!Number.isFinite(years) || years <= 0) return 'End age must be greater than start age.'
  return null
}

/**
 * Folds `age` onto each row: the API counts years elapsed, every label on
 * screen is an age. Memoised because the charts detect a genuinely new dataset
 * by array identity to decide whether to replay their draw-in animation, so a
 * fresh array on every render would restart it mid-scrub.
 *
 * startAge only shifts the labels, never the request, which is why it belongs
 * here rather than in the payload.
 */
export function useAges(data, startAge) {
  return useMemo(
    () =>
      data && {
        ...data,
        rows: data.yearly_breakdown.map((row) => ({ ...row, age: startAge + row.year })),
      },
    [data, startAge],
  )
}

/**
 * The single-rate projection. Fires whenever the applied params change — the
 * caller decides when that is, e.g. on an explicit "Apply" click rather than
 * every keystroke, to keep API calls infrequent.
 */
export function useProjection({ initial, monthly, rate, startAge, endAge }, enabled = true) {
  const years = endAge - startAge

  const { data, error, pending } = useRemote({
    fetcher: calculateGrowth,
    payload: {
      initial_amount: initial,
      monthly_contribution: monthly,
      annual_rate: rate,
      years,
    },
    invalid: validateAges(years),
    enabled,
  })

  return { data: useAges(data, startAge), error, pending }
}
