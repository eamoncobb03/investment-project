import { useState } from 'react'
import { AlertTriangleIcon, ArrowLeftIcon } from 'lucide-react'
import Field from '@/components/Field'
import Chart from '@/components/Chart'
import FanChart from '@/components/FanChart'
import Histogram from '@/components/Histogram'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProjection } from '@/lib/useProjection'
import { useSimulation } from '@/lib/useSimulation'
import { useAnimatedNumber } from '@/lib/useAnimatedNumber'
import { money, toNumber } from '@/lib/format'

const DEFAULTS = {
  initial: '5000',
  monthly: '400',
  rate: '7',
  startAge: '25',
  endAge: '65',
  volatility: '15',
  target: '1000000',
}

// Absolute rather than relative: this app is served both at its own domain and
// proxied under eamoncobb.com/investmentplanner/, and a relative "../" would
// land somewhere different in each case.
const SITE_URL = 'https://eamoncobb.com/'

const toApplied = (draft) =>
  Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, toNumber(value)]))

function Split({ label, note, value, accent }) {
  return (
    <Card
      className={`gap-0.5 px-3.5 [--card-spacing:--spacing(3.5)] ${
        accent ? 'bg-secondary ring-0' : ''
      }`}
    >
      <span className="text-muted-foreground flex items-baseline justify-between gap-2 text-[0.72rem] tracking-[0.07em] uppercase">
        {label}
        {note && <span className="font-mono tracking-normal normal-case">{note}</span>}
      </span>
      <strong
        className={`font-mono text-[1.05rem] font-semibold tabular-nums ${accent ? 'text-primary' : ''}`}
      >
        {value}
      </strong>
    </Card>
  )
}

function Swatch({ className, children }) {
  return (
    <span className="flex items-center gap-1.5">
      {/* The faint band tints are barely visible at swatch size, so these
          carry a hairline ring to give the chip an edge to be seen by. */}
      <span aria-hidden className={`ring-border size-2.5 rounded-[3px] ring-1 ${className}`} />
      {children}
    </span>
  )
}

function ResultsSkeleton({ extra }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="space-y-2 px-0.5 py-1">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-4 w-52" />
      </div>
      <Card className="px-2.5 [--card-spacing:--spacing(2.5)]">
        <Skeleton className={extra ? 'h-[340px] w-full' : 'h-[300px] w-full'} />
      </Card>
      <div className="grid gap-2.5 min-[460px]:grid-cols-3">
        <Skeleton className="h-[68px]" />
        <Skeleton className="h-[68px]" />
        <Skeleton className="h-[68px]" />
      </div>
      {extra && (
        <Card className="px-2.5 [--card-spacing:--spacing(2.5)]">
          <Skeleton className="h-[170px] w-full" />
        </Card>
      )}
    </div>
  )
}

function App() {
  // Draft values back the fields and sliders directly, so dragging a slider
  // feels instant. They're only sent to the API when "Apply" is pressed,
  // instead of on every change — that kept firing a request per keystroke.
  const [draft, setDraft] = useState(DEFAULTS)
  const [applied, setApplied] = useState(() => toApplied(DEFAULTS))

  // The mode is a view toggle rather than an assumption, so unlike the fields
  // it takes effect immediately instead of waiting for Apply.
  const [mode, setMode] = useState('single')
  const simulating = mode === 'monte'

  // null means "follow the end of the projection" until the user scrubs.
  const [pinned, setPinned] = useState(null)

  const setField = (field) => (value) => setDraft((d) => ({ ...d, [field]: value }))

  const isDirty = Object.keys(draft).some((key) => toNumber(draft[key]) !== applied[key])

  const apply = (e) => {
    e.preventDefault()
    setApplied(toApplied(draft))
    setPinned(null)
  }

  // Only the active mode's endpoint is called; the other hook sits idle rather
  // than fetching a result nothing is going to render.
  const single = useProjection(applied, !simulating)
  const monte = useSimulation(applied, simulating)
  const { data, error, pending } = simulating ? monte : single

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

  const odds = useAnimatedNumber(data?.probability_target ?? 0)
  const median = useAnimatedNumber(active?.p50 ?? 0)
  const low = useAnimatedNumber(active?.p5 ?? 0)
  const high = useAnimatedNumber(active?.p95 ?? 0)

  const years = toNumber(draft.endAge) - toNumber(draft.startAge)

  return (
    <div className="mx-auto max-w-[1040px] px-[18px] pt-7 pb-18">
      <header className="mb-6">
        <a
          href={SITE_URL}
          className="text-muted-foreground hover:text-primary group mb-5 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeftIcon className="size-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Eamon Cobb
        </a>

        <h1 className="font-mono text-[clamp(1.6rem,6vw,2.3rem)] font-semibold tracking-[-0.03em]">
          Investment <span className="text-primary">Planner</span>
        </h1>
        <p className="text-muted-foreground mt-1.5 text-[0.95rem]">
          See what steady contributions turn into over time.
        </p>
      </header>

      <main className="grid items-start gap-[18px] md:grid-cols-[310px_1fr] md:gap-6">
        {/* Sticky only where there is a second column to sit beside; on one
            column a sticky panel overlaps the content below it. Dragging a
            slider should not start selecting its label text, but the value
            fields stay selectable so they can still be edited and copied. */}
        <Card className="md:sticky md:top-5">
          <form
            aria-label="Assumptions"
            onSubmit={apply}
            className="flex touch-manipulation flex-col gap-5 px-5 select-none"
          >
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
              label={simulating ? 'Average return' : 'Annual return'}
              suffix="%"
              value={draft.rate}
              onChange={setField('rate')}
              min={0}
              max={100}
              sliderMax={15}
              step={0.1}
            />

            {simulating && (
              <>
                <Field
                  label="Volatility"
                  suffix="%"
                  value={draft.volatility}
                  onChange={setField('volatility')}
                  min={0}
                  max={100}
                  sliderMax={40}
                  step={0.5}
                />
                <Field
                  label="Target"
                  prefix="$"
                  wide
                  value={draft.target}
                  onChange={setField('target')}
                  min={0}
                  max={1000000000}
                  sliderMax={5000000}
                  step={25000}
                />
              </>
            )}

            <Separator />

            <fieldset className="m-0 border-0 p-0">
              <legend className="text-muted-foreground mb-3 flex w-full items-baseline justify-between gap-2 text-sm">
                Age range
                {years > 0 && (
                  <span className="font-mono text-xs tabular-nums">
                    {years} {years === 1 ? 'year' : 'years'}
                  </span>
                )}
              </legend>
              <div className="grid grid-cols-2 gap-4">
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

            <Button
              type="submit"
              size="lg"
              disabled={!isDirty}
              // A dimmed primary still reads as an action. When there is
              // nothing to apply the button goes neutral instead.
              className="h-11 font-mono disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            >
              {isDirty ? 'Apply changes' : 'Up to date'}
            </Button>
          </form>
        </Card>

        <section className="flex min-w-0 flex-col gap-4" aria-live="polite">
          {/* This theme sets --muted to the page background, so the default
              tab styling would put an invisible tray behind an invisible
              active pill. The pale green and the card white are the two
              surfaces in this palette that actually read against it. */}
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="bg-secondary w-full">
              <TabsTrigger value="single" className="data-active:bg-card">
                Single rate
              </TabsTrigger>
              <TabsTrigger value="monte" className="data-active:bg-card">
                Monte Carlo
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {error && (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>That didn&rsquo;t work</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!error && !data && <ResultsSkeleton extra={simulating} />}

          {!error && data && !simulating && (
            <>
              <div
                className={`flex flex-col gap-0.5 px-0.5 py-1 transition-opacity duration-200 ${
                  pending ? 'opacity-55' : ''
                }`}
              >
                <span className="text-muted-foreground text-[0.8rem] tracking-[0.09em] uppercase">
                  Balance at age {active.age}
                </span>
                {/* Tabular figures stop the number jittering as it animates. */}
                <strong className="font-mono text-[clamp(2.1rem,9vw,3.4rem)] leading-[1.05] font-semibold tracking-[-0.035em] tabular-nums">
                  {money(balance)}
                </strong>
                <span className="text-muted-foreground mt-1 flex items-center gap-2 text-[0.9rem]">
                  {money(interest)} of that is growth
                  <span className="bg-secondary text-primary rounded-full px-2 py-0.5 font-mono text-[0.78rem] tabular-nums">
                    {Math.round(growth)}%
                  </span>
                </span>
              </div>

              <Card className="gap-0 px-2.5 [--card-spacing:--spacing(2.5)]">
                <Chart rows={rows} activeIndex={activeIndex} onScrub={setPinned} />
                <div className="text-muted-foreground flex flex-wrap items-center gap-3.5 px-2 pt-2 pb-0.5 text-[0.78rem] select-none">
                  <Swatch className="bg-contributed">You put in</Swatch>
                  <Swatch className="bg-primary/30">Growth</Swatch>
                  <span className="ml-auto">Drag across the chart</span>
                </div>
              </Card>

              <div className="grid gap-2.5 min-[460px]:grid-cols-3">
                <Split label="You put in" value={money(contributed)} />
                <Split label="Growth" value={money(interest)} accent />
                <Split label="Total" value={money(balance)} />
              </div>
            </>
          )}

          {!error && data && simulating && (
            <>
              <div
                className={`flex flex-col gap-0.5 px-0.5 py-1 transition-opacity duration-200 ${
                  pending ? 'opacity-55' : ''
                }`}
              >
                <span className="text-muted-foreground text-[0.8rem] tracking-[0.09em] uppercase">
                  Odds of reaching {money(data.target)}
                </span>
                <strong className="font-mono text-[clamp(2.1rem,9vw,3.4rem)] leading-[1.05] font-semibold tracking-[-0.035em] tabular-nums">
                  {Math.round(odds)}%
                </strong>
                <span className="text-muted-foreground mt-1 text-[0.9rem]">
                  Across {data.paths_simulated.toLocaleString()} simulated futures. The typical
                  one ends at {money(data.final.p50)} by age {rows[lastIndex].age}.
                </span>
              </div>

              <Card className="gap-0 px-2.5 [--card-spacing:--spacing(2.5)]">
                <FanChart
                  rows={rows}
                  paths={data.sample_paths}
                  target={data.target}
                  activeIndex={activeIndex}
                  onScrub={setPinned}
                />
                <div className="text-muted-foreground flex flex-wrap items-center gap-3.5 px-2 pt-2 pb-0.5 text-[0.78rem] select-none">
                  <Swatch className="bg-primary">Median</Swatch>
                  <Swatch className="bg-primary/26">Middle 50%</Swatch>
                  <Swatch className="bg-primary/14">5th to 95th</Swatch>
                  <Swatch className="bg-contributed">You put in</Swatch>
                  <span className="ml-auto">Drag across the chart</span>
                </div>
              </Card>

              <div className="grid gap-2.5 min-[460px]:grid-cols-3">
                <Split label={`Age ${active.age}`} note="5th" value={money(low)} />
                <Split label={`Age ${active.age}`} note="median" value={money(median)} accent />
                <Split label={`Age ${active.age}`} note="95th" value={money(high)} />
              </div>

              <Card className="gap-0 px-2.5 [--card-spacing:--spacing(2.5)]">
                <Histogram
                  edges={data.histogram.edges}
                  counts={data.histogram.counts}
                  target={data.target}
                  median={data.final.p50}
                />
                <p className="text-muted-foreground px-2 pt-2 pb-0.5 text-[0.78rem] select-none">
                  Where every run landed by age {rows[lastIndex].age}.{' '}
                  {data.probability_below_contributed > 0 && (
                    <>
                      {data.probability_below_contributed}% finished below the{' '}
                      {money(data.total_contributed)} put in.
                    </>
                  )}
                </p>
              </Card>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
