import { useState } from 'react'
import { AlertTriangleIcon, ArrowLeftIcon } from 'lucide-react'
import Field from '@/components/Field'
import Chart from '@/components/Chart'
import FanChart from '@/components/FanChart'
import Histogram from '@/components/Histogram'
import Hint from '@/components/Hint'
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

/**
 * The one number the page is answering with, however the mode phrases it.
 *
 * Both modes fill the same three slots — a quiet label, the number, and one
 * supporting line beside it — so switching between them moves the value rather
 * than rearranging the page around it.
 */
function Headline({ eyebrow, value, detail, pending }) {
  return (
    <div
      className={`flex flex-col gap-1 px-1 transition-opacity duration-200 ${
        pending ? 'opacity-55' : ''
      }`}
    >
      <span className="text-muted-foreground text-[0.78rem] tracking-[0.1em] uppercase">
        {eyebrow}
      </span>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* Tabular figures stop the number jittering as it animates. */}
        <strong className="font-mono text-[clamp(2rem,6.5vw,2.9rem)] leading-[1] font-semibold tracking-[-0.04em] tabular-nums">
          {value}
        </strong>
        <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[0.88rem]">
          {detail}
        </span>
      </div>
    </div>
  )
}

/** One label-and-value pair from the strip under a chart. */
function Stat({ note, value, accent }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-muted-foreground text-[0.68rem] tracking-[0.08em] uppercase">
        {note}
      </span>
      <strong
        className={`font-mono text-[0.88rem] font-semibold tabular-nums ${
          accent ? 'text-primary' : ''
        }`}
      >
        {value}
      </strong>
    </span>
  )
}

/**
 * A legend chip. `line` draws a short bar instead of a square, so the entries
 * standing for lines on the chart do not claim to be filled regions.
 */
function Swatch({ className, line, children }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={
          line
            ? `h-[3px] w-3 rounded-full ${className}`
            : `ring-border/60 size-2.5 rounded-[3px] ring-1 ${className}`
        }
      />
      {children}
    </span>
  )
}

/**
 * The frame both modes draw into: a caption row, the plot, the numbers it is
 * currently reporting, and a legend.
 *
 * Holding this shape fixed is what keeps the two modes comparable, and it is
 * also what keeps the page inside a laptop screen — Monte Carlo used to stack
 * a second chart underneath, which is what kept falling below the fold.
 */
function ChartPanel({ caption, toolbar, stats, legend, pending, children }) {
  return (
    <Card
      className={`gap-0 px-3 [--card-spacing:--spacing(3)] transition-opacity duration-200 ${
        pending ? 'opacity-55' : ''
      }`}
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 pb-1">
        <span className="text-muted-foreground text-[0.7rem] tracking-[0.1em] uppercase">
          {caption}
        </span>
        {toolbar}
      </div>

      {children}

      <Separator className="mt-2" />

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 pt-2.5">{stats}</div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pt-2.5 text-[0.75rem] select-none">
        {legend}
      </div>
    </Card>
  )
}

/** Mirrors the shape above so nothing shifts when the data lands. */
function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="space-y-2 px-1">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-11 w-56" />
      </div>
      <Card className="gap-0 px-3 [--card-spacing:--spacing(3)]">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-[272px] w-full" />
        <Skeleton className="mt-4 h-4 w-72" />
        <Skeleton className="mt-3 h-3 w-60" />
      </Card>
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

  // Which plot the Monte Carlo panel is showing. The two are the same ten
  // thousand runs read along different axes — across time, or collapsed onto
  // the finish line — so they share a slot rather than stacking.
  const [view, setView] = useState('time')
  const outcomes = simulating && view === 'outcomes'

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
  const finalAge = rows[lastIndex]?.age

  const growthPct = active?.balance ? (active.interest_earned / active.balance) * 100 : 0

  // The outcomes plot has no time axis to scrub, so its numbers report the
  // finish line instead of wherever the cursor was left on the other view.
  const source = outcomes ? data?.final : active

  // These chase their targets frame by frame: a single Apply reads as a
  // count-up, and dragging the chart reads as the numbers trailing the
  // scrub rather than jumping on every pointer move.
  const balance = useAnimatedNumber(active?.balance ?? 0)
  const contributed = useAnimatedNumber(active?.total_contributed ?? 0)
  const interest = useAnimatedNumber(active?.interest_earned ?? 0)
  const growth = useAnimatedNumber(growthPct)

  const odds = useAnimatedNumber(data?.probability_target ?? 0)
  const low = useAnimatedNumber(source?.p5 ?? 0)
  const median = useAnimatedNumber(source?.p50 ?? 0)
  const high = useAnimatedNumber(source?.p95 ?? 0)

  const years = toNumber(draft.endAge) - toNumber(draft.startAge)

  return (
    <div className="mx-auto max-w-[1100px] px-[18px] pt-6 pb-16">
      <header className="mb-5">
        <a
          href={SITE_URL}
          className="text-muted-foreground hover:text-primary group mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeftIcon className="size-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Eamon Cobb
        </a>

        <h1 className="font-mono text-[clamp(1.5rem,5vw,2rem)] font-semibold tracking-[-0.03em]">
          Investment <span className="text-primary">Planner</span>
        </h1>
      </header>

      <main className="grid items-start gap-[18px] md:grid-cols-[300px_1fr] md:gap-5">
        {/* Sticky only where there is a second column to sit beside; on one
            column a sticky panel overlaps the content below it. Dragging a
            slider should not start selecting its label text, but the value
            fields stay selectable so they can still be edited and copied. */}
        <Card className="md:sticky md:top-4">
          <form
            aria-label="Assumptions"
            onSubmit={apply}
            className="flex touch-manipulation flex-col gap-4 px-5 select-none"
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
              hint={
                simulating
                  ? 'The yearly return averaged over the whole run, which individual years land above and below.'
                  : 'The return earned every single year, before inflation.'
              }
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
                  hint="How much returns swing from year to year, around 15% for a broad stock index."
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
                  hint="The balance the odds above are measured against."
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

        <section className="flex min-w-0 flex-col gap-3" aria-live="polite">
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

          {!error && !data && <ResultsSkeleton />}

          {!error && data && !simulating && (
            <>
              <Headline
                pending={pending}
                eyebrow={`Balance at age ${active.age}`}
                value={money(balance)}
                detail={
                  <>
                    {money(interest)} of that is growth
                    <span className="bg-secondary text-primary rounded-full px-2 py-0.5 font-mono text-[0.75rem] tabular-nums">
                      {Math.round(growth)}%
                    </span>
                  </>
                }
              />

              <ChartPanel
                pending={pending}
                caption={`At age ${active.age}`}
                stats={
                  <>
                    <Stat note="You put in" value={money(contributed)} />
                    <Stat note="Growth" value={money(interest)} accent />
                    <Stat note="Total" value={money(balance)} />
                  </>
                }
                legend={
                  <>
                    <Swatch className="bg-contributed">You put in</Swatch>
                    <Swatch className="bg-primary/30">Growth</Swatch>
                    <span className="ml-auto hidden sm:inline">Drag across the chart</span>
                  </>
                }
              >
                <Chart rows={rows} activeIndex={activeIndex} onScrub={setPinned} />
              </ChartPanel>
            </>
          )}

          {!error && data && simulating && (
            <>
              <Headline
                pending={pending}
                eyebrow={`Odds of reaching ${money(data.target)}`}
                value={`${Math.round(odds)}%`}
                detail={
                  <>
                    Typically {money(data.final.p50)} by age {finalAge}
                    <Hint label="What the typical outcome means">
                      The middle result, with half the runs finishing above it and half below.
                    </Hint>
                  </>
                }
              />

              <ChartPanel
                pending={pending}
                caption={outcomes ? `By age ${finalAge}` : `At age ${active.age}`}
                toolbar={
                  <Tabs value={view} onValueChange={setView}>
                    <TabsList className="bg-secondary h-7">
                      <TabsTrigger value="time" className="data-active:bg-card text-[0.75rem]">
                        Over time
                      </TabsTrigger>
                      <TabsTrigger value="outcomes" className="data-active:bg-card text-[0.75rem]">
                        Outcomes
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                }
                stats={
                  <>
                    <Stat note="5th" value={money(low)} />
                    <Stat note="Median" value={money(median)} accent />
                    <Stat note="95th" value={money(high)} />
                  </>
                }
                legend={
                  outcomes ? (
                    <>
                      <Swatch className="bg-(--band-inner)">Reached the target</Swatch>
                      <Swatch className="bg-contributed">Fell short</Swatch>
                      <span className="ml-auto">
                        {data.probability_below_contributed > 0 &&
                          `${data.probability_below_contributed}% finished below the ${money(
                            data.total_contributed,
                          )} put in`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Swatch line className="bg-(--median-line)">
                        Median
                      </Swatch>
                      <Swatch className="bg-(--band-inner)">Middle 50%</Swatch>
                      <Swatch className="bg-(--band-outer)">5th to 95th</Swatch>
                      <Swatch line className="bg-(--path-line)">
                        Sample runs
                      </Swatch>
                      <Swatch line className="bg-(--contributed-line)">
                        You put in
                      </Swatch>
                      <span className="ml-auto hidden sm:inline">Drag across the chart</span>
                    </>
                  )
                }
              >
                {outcomes ? (
                  <Histogram
                    edges={data.histogram.edges}
                    counts={data.histogram.counts}
                    target={data.target}
                    median={data.final.p50}
                  />
                ) : (
                  <FanChart
                    rows={rows}
                    paths={data.sample_paths}
                    target={data.target}
                    activeIndex={activeIndex}
                    onScrub={setPinned}
                  />
                )}
              </ChartPanel>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
