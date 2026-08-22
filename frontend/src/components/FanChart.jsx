import { useId, useRef, useState } from 'react'
import { moneyCompact } from '@/lib/format'

const W = 640
const H = 340
const PAD = { top: 20, right: 14, bottom: 30, left: 56 }
const IW = W - PAD.left - PAD.right
const IH = H - PAD.top - PAD.bottom

// Rounds the axis top up to a clean multiple so the gridline labels read well.
// Finer steps than the single-rate chart uses: p95 can land just above a round
// number, and the coarse 1/2/2.5/5 ladder would then nearly double the axis and
// leave the whole distribution sitting in the bottom half of the plot.
function niceMax(value) {
  if (value <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(value))
  const step = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => value <= s * mag) ?? 10
  return step * mag
}

/**
 * The distribution of outcomes over time: two shaded percentile bands, a
 * median line, and a handful of individual paths drawn over the top.
 *
 * The sample paths are the point of the whole picture. Bands alone look like
 * a smooth statistical object and invite the same false confidence as a single
 * projected line; the squiggles are what show that any one future is jagged,
 * and that the smooth band is a summary of many rough paths rather than a
 * description of any of them.
 */
export default function FanChart({ rows, paths, target, activeIndex, onScrub }) {
  const svgRef = useRef(null)
  const clipId = useId()

  // Bumped only when the dataset is genuinely new (a fresh Apply), never by
  // scrubbing, which changes activeIndex on the same arrays. Keying the drawn
  // series on it remounts those nodes so their CSS draw-in replays on real
  // updates and stays silent while dragging. Comparing against the previous
  // prop and setting state in the render body is React's documented pattern:
  // it bails out and re-renders before the browser paints.
  const [prevRows, setPrevRows] = useState(rows)
  const [version, setVersion] = useState(0)
  if (prevRows !== rows) {
    setPrevRows(rows)
    setVersion((v) => v + 1)
  }

  const n = rows.length

  // Scaled to the band, not to the sample paths. One path in twenty ends above
  // p95 by construction, and letting a single lucky run set the ceiling pushed
  // the whole distribution into the bottom fifth of the plot on most runs. The
  // paths that do overshoot are clipped at the top edge instead, which is the
  // usual bargain for a fan chart: the bands stay readable and the rare
  // runaway leaves the frame.
  const max = niceMax(Math.max(...rows.map((r) => r.p95)) * 1.08)

  const x = (i) => PAD.left + (n <= 1 ? IW / 2 : (i / (n - 1)) * IW)
  const y = (v) => PAD.top + IH - (v / max) * IH

  const lineOf = (values) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')

  // Out along the upper percentile, back along the lower one, closed.
  const band = (lo, hi) => {
    const forward = lineOf(rows.map((r) => r[hi]))
    const back = []
    for (let i = n - 1; i >= 0; i -= 1) back.push(`L${x(i)},${y(rows[i][lo])}`)
    return `${forward} ${back.join(' ')} Z`
  }

  const contributed = `${lineOf(rows.map((r) => r.total_contributed))} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`

  // Maps a pointer position through the viewBox, so it stays correct at any
  // rendered size without measuring the element's pixel dimensions.
  const scrubFrom = (clientX) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect?.width) return
    const svgX = ((clientX - rect.left) / rect.width) * W
    const t = (svgX - PAD.left) / IW
    onScrub(Math.round(Math.min(Math.max(t, 0), 1) * (n - 1)))
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const labelEvery = Math.max(1, Math.ceil(n / 8))
  const active = rows[activeIndex]
  const targetVisible = target > 0 && target <= max

  return (
    <svg
      ref={svgRef}
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Range of simulated balances from age ${rows[0].age} to ${rows[n - 1].age}`}
      tabIndex={0}
      onPointerDown={(e) => {
        // Stops the browser starting a text selection that would drag out
        // across the headline and legend. It also suppresses the default
        // focus, so that is done explicitly to keep arrow-key scrubbing.
        e.preventDefault()
        e.currentTarget.focus()
        e.currentTarget.setPointerCapture(e.pointerId)
        scrubFrom(e.clientX)
      }}
      onPointerMove={(e) => {
        if (e.buttons || e.pointerType === 'touch') scrubFrom(e.clientX)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onScrub(Math.max(0, activeIndex - 1))
        if (e.key === 'ArrowRight') onScrub(Math.min(n - 1, activeIndex + 1))
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={PAD.left} y={PAD.top} width={IW} height={IH} />
        </clipPath>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={PAD.left - 10} y={y(t)} dy="0.32em" className="chart-tick chart-tick-y">
            {moneyCompact(t)}
          </text>
        </g>
      ))}

      <g key={version} className="chart-series" clipPath={`url(#${clipId})`}>
        <path d={band('p5', 'p95')} className="fan-band fan-band-outer" />
        <path d={band('p25', 'p75')} className="fan-band fan-band-inner" />
        <path d={contributed} className="chart-contributed" />

        {paths.map((path, i) => (
          <path
            key={i}
            d={lineOf(path)}
            className="fan-path"
            pathLength="1"
            // Staggered so the paths arrive as a scatter rather than all at
            // once, which reads as many separate futures being rolled.
            style={{ '--i': i }}
          />
        ))}

        <path d={lineOf(rows.map((r) => r.p50))} className="fan-median" pathLength="1" />
      </g>

      {targetVisible && (
        <g className="fan-target">
          <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} />
          <text x={W - PAD.right} y={y(target) - 6} textAnchor="end">
            {moneyCompact(target)} target
          </text>
        </g>
      )}

      {rows.map((r, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text key={r.age} x={x(i)} y={H - 10} className="chart-tick" textAnchor="middle">
            {r.age}
          </text>
        ) : null,
      )}

      {active && (
        <g className="chart-cursor">
          <line x1={x(activeIndex)} x2={x(activeIndex)} y1={PAD.top} y2={PAD.top + IH} />
          <circle cx={x(activeIndex)} cy={y(active.p50)} r="5.5" />
        </g>
      )}
    </svg>
  )
}
