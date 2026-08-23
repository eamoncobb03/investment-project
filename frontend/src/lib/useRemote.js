import { useEffect, useRef, useState } from 'react'

/**
 * Shared plumbing behind useProjection and useSimulation.
 *
 * Both endpoints need the same guarantee: every run aborts the request before
 * it and carries a sequence number, so a slow earlier response can never
 * overwrite a newer one. That is subtle enough to be worth keeping in one
 * place rather than copied into each hook, where the two copies would drift.
 *
 * `pending` is derived by comparing the key that produced the current data
 * against the key currently applied, rather than being set true at the top of
 * the effect. Setting it would force an extra render on every change just to
 * flip a flag before the real result arrives.
 *
 * `fetcher` has to be defined at module scope so its identity is stable; a
 * function built during render would refire the effect on every pass.
 */
export function useRemote({ fetcher, payload, invalid = null, enabled = true }) {
  const key = JSON.stringify(payload)
  const [state, setState] = useState({ data: null, error: null, key: null })
  const seq = useRef(0)

  // The key whose result is currently sitting in `state`, or null when that is
  // an error rather than data. `enabled` is part of the dependency list below,
  // so flipping it — which is what switching modes does — re-runs the effect
  // even when the params have not moved. Left to itself that refetches an
  // answer already in hand, and the identical response still arrives as a new
  // object, which the charts read as a new dataset and replay their whole
  // draw-in for. On screen that is a stutter: the content appears from state,
  // then animates in again a moment later.
  //
  // Clearing it on failure is what keeps that invariant true, and it matters:
  // holding the last *successful* key instead would skip the refetch on
  // returning to params that once worked, while `state` still held a newer
  // request's error, leaving the mode stuck on that error with nothing left to
  // retry it.
  //
  // A ref rather than reading `state`, which would have to join the dependency
  // list and loop.
  const settled = useRef(null)

  useEffect(() => {
    if (!enabled || invalid) return
    if (settled.current === key) return

    const controller = new AbortController()
    const id = ++seq.current

    // Parsed back out of the key rather than captured from the render that
    // scheduled this. The key *is* the serialised payload, so reading it this
    // way leaves the effect depending on nothing outside its dependency list,
    // and there is no version of the payload it could go stale against.
    fetcher(JSON.parse(key), controller.signal)
      .then((data) => {
        if (id !== seq.current) return
        settled.current = key
        setState({ data, error: null, key })
      })
      .catch((err) => {
        if (err.name === 'AbortError' || id !== seq.current) return
        settled.current = null
        setState({ data: null, error: err.message, key })
      })

    return () => controller.abort()
  }, [fetcher, key, invalid, enabled])

  if (invalid) return { data: null, error: invalid, pending: false }
  return { data: state.data, error: state.error, pending: state.key !== key }
}
