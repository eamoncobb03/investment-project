import { useState } from 'react'
import Field from './components/Field'
import Chart from './components/Chart'
import { useProjection } from './lib/useProjection'
import { useAnimatedNumber } from './lib/useAnimatedNumber'
import { money, toNumber } from './lib/format'
import './App.css'

const DEFAULTS = { initial: '5000', monthly: '400', rate: '7', startAge: '25', endAge: '65' }

const toApplied = (draft) => ({
  initial: toNumber(draft.initial),
  monthly: toNumber(draft.monthly),
  rate: toNumber(draft.rate),
  startAge: toNumber(draft.startAge),
  endAge: toNumber(draft.endAge),
})

function App() {
  // Draft values back the fields and sliders directly, so dragging a slider
  // feels instant. They're only sent to the API when "Apply" is pressed,
  // instead of on every change — that kept firing a request per keystroke.
  const [draft, setDraft] = useState(DEFAULTS)
  const [applied, setApplied] = useState(() => toApplied(DEFAULTS))

  // null means "follow the end of the projection" until the user scrubs.
  const [pinned, setPinned] = useState(null)

  const setField = (field) => (value) => setDraft((d) => ({ ...d, [field]: value }))

  const isDirty = Object.keys(draft).some((key) => toNumber(draft[key]) !== applied[key])

  const apply = (e) => {
    e.preventDefault()
    setApplied(toApplied(draft))
    setPinned(null)
  }

  const { data, error, pending } = useProjection(applied)

  const rows = data?.rows ?? []
  const lastIndex = Math.max(0, rows.length - 1)
  const activeIndex = pinned === null ? lastIndex : Math.min(pinned, lastIndex)
  const active = rows[activeIndex]

  const growthPct = active?.balance ? (active.interest_earned / active.balance) * 100 : 0

  // These chase their targets frame by frame: a single Apply reads as a
  // count-up, and dragging the chart reads as the numbers trailing the
  // scrub rather than jumping on every pointer move.
  const balance = useAnimatedNumber(active?.balance ?? 0)
  const contributed = useAnimatedNumber(active?.total_contributed ?? 0)
  const interest = useAnimatedNumber(active?.interest_earned ?? 0)
  const growth = useAnimatedNumber(growthPct)

  return (
    <div className="page">
      <header className="masthead">
        <h1>
          Investment <span>Planner</span>
        </h1>
        <p>See what steady contributions turn into over time.</p>
      </header>

      <main className="layout">
        <form className="panel controls" aria-label="Assumptions" onSubmit={apply}>
          <Field
            label="Starting amount"
            prefix="$"
            value={draft.initial}
            onChange={setField('initial')}
            min={0}
            max={1000000}
            sliderMax={100000}
            step={500}
          />
          <Field
            label="Monthly contribution"
            prefix="$"
            value={draft.monthly}
            onChange={setField('monthly')}
            min={0}
            max={100000}
            sliderMax={3000}
            step={25}
          />
          <Field
            label="Annual return"
            suffix="%"
            value={draft.rate}
            onChange={setField('rate')}
            min={0}
            max={100}
            sliderMax={15}
            step={0.1}
          />
          <fieldset className="age-group">
            <legend>Age range</legend>
            <div className="age-row">
              <Field
                label="From"
                value={draft.startAge}
                onChange={setField('startAge')}
                min={16}
                max={90}
                sliderMax={90}
                step={1}
              />
              <Field
                label="To"
                value={draft.endAge}
                onChange={setField('endAge')}
                min={16}
                max={90}
                sliderMax={90}
                step={1}
              />
            </div>
          </fieldset>

          <button type="submit" className="apply-btn" disabled={!isDirty}>
            {isDirty ? 'Apply changes' : 'Up to date'}
          </button>
        </form>

        <section className="results" aria-live="polite">
          {error && <p className="notice notice-error">{error}</p>}

          {!error && !data && <p className="notice">Crunching the numbers…</p>}

          {!error && data && (
            <>
              <div className={`headline ${pending ? 'is-stale' : ''}`}>
                <span className="headline-label">Balance at age {active.age}</span>
                <strong className="headline-value">{money(balance)}</strong>
                <span className="headline-sub">
                  {money(interest)} of that is growth
                  <span className="headline-pct">{Math.round(growth)}%</span>
                </span>
              </div>

              <div className="panel chart-panel">
                <Chart rows={rows} activeIndex={activeIndex} onScrub={setPinned} />
                <div className="legend">
                  <span className="legend-item legend-contributed">You put in</span>
                  <span className="legend-item legend-growth">Growth</span>
                  <span className="legend-hint">Drag across the chart</span>
                </div>
              </div>

              <div className="splits">
                <div className="split">
                  <span>You put in</span>
                  <strong>{money(contributed)}</strong>
                </div>
                <div className="split split-growth">
                  <span>Growth</span>
                  <strong>{money(interest)}</strong>
                </div>
                <div className="split">
                  <span>Total</span>
                  <strong>{money(balance)}</strong>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
