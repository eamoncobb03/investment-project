import { simulateGrowth } from './api'
import { useRemote } from './useRemote'
import { useAges, validateAges } from './useProjection'

/**
 * The Monte Carlo run. Same shape and the same apply-then-fetch rhythm as
 * useProjection, so switching modes does not change how the form behaves.
 *
 * Its rows carry the five percentile bands for a year rather than one balance,
 * and the response also brings the sample paths, the outcome histogram and the
 * odds of clearing the target, none of which have an equivalent in the
 * single-rate result.
 */
export function useSimulation(
  { initial, monthly, rate, volatility, target, startAge, endAge },
  enabled = true,
) {
  const years = endAge - startAge

  const { data, error, pending } = useRemote({
    fetcher: simulateGrowth,
    payload: {
      initial_amount: initial,
      monthly_contribution: monthly,
      annual_rate: rate,
      volatility,
      years,
      target,
    },
    invalid: validateAges(years),
    enabled,
  })

  return { data: useAges(data, startAge), error, pending }
}
