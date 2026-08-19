import { useRef, useState } from 'react'
import { moneyCompact } from '@/lib/format'

const W = 640
const H = 300
const PAD = { top: 18, right: 14, bottom: 30, left: 56 }
const IW = W - PAD.left - PAD.right
const IH = H - PAD.top - PAD.bottom

// Rounds the axis top up to a clean 1/2/5 x 10^n so the gridline labels read well.
function niceMax(value) {
  if (value <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((s) => value <= s * mag) ?? 10
  return step * mag
}

export default function Chart({ rows, activeIndex, onScrub }) {
  const svgRef = useRef(null)

  // Bumped only when `rows` is a genuinely new dataset (a fresh Apply),
  // never by scrubbing (which just changes activeIndex on the same array).
  // Keying the drawn series on it remounts those elements so their CSS
  // "draw in" animation replays on real updates and stays silent while
  // dragging. Comparing against the previous prop and calling setState
  // directly in the render body (not in an effect) is React's documented
  // pattern for this — it bails out and re-renders before the browser
  // paints, rather than committing stale output first.
  const [prevRows, setPrevRows] = useState(rows)
  const [version, setVersion] = useState(0)
  if (prevRows !== rows) {
    setPrevRows(rows)
    setVersion((v) => v + 1)
  }

  const n = rows.length
  const max = niceMax(Math.max(...rows.map((r) => r.balance)))

  const x = (i) => PAD.left + (n <= 1 ? IW / 2 : (i / (n - 1)) * IW)
  const y = (v) => PAD.top + IH - (v / max) * IH

  const line = (key) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r[key])}`).join(' ')
  const area = (key) =>
    `${line(key)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`

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

  return (
    <svg
      ref={svgRef}
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Projected balance from age ${rows[0].age} to ${rows[n - 1].age}`}
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
        <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={PAD.left - 10} y={y(t)} dy="0.32em" className="chart-tick chart-tick-y">
            {moneyCompact(t)}
          </text>
        </g>
      ))}

      <g key={version} className="chart-series">
        <path d={area('balance')} className="chart-area" fill="url(#fillTotal)" />
        <path d={area('total_contributed')} className="chart-contributed" />
        <path d={line('balance')} className="chart-line" pathLength="1" />
      </g>

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
          <circle cx={x(activeIndex)} cy={y(active.balance)} r="5.5" />
        </g>
      )}
    </svg>
  )
}
