import { useState } from 'react'
import { moneyCompact } from '@/lib/format'

// Squarer than the fan chart's box on purpose. This one sits in a column
// roughly half the page width, and a 640-wide viewBox scaled down to fit left
// it about ninety pixels tall, which is too flat to read a distribution off.
const W = 420
const H = 200
const PAD = { top: 18, right: 10, bottom: 26, left: 10 }
const IW = W - PAD.left - PAD.right
const IH = H - PAD.top - PAD.bottom

/**
 * Where the ten thousand runs actually landed.
 *
 * Bars are coloured by which side of the target they fall on, which makes the
 * shaded fraction of the shape the probability itself rather than a number
 * printed next to a picture. The line marks the exact threshold, since a bar
 * straddling it is tinted by its midpoint and would otherwise be ambiguous.
 */
export default function Histogram({ edges, counts, target, median }) {
  // Same remount trick the charts use: bumped only when the counts are a
  // genuinely new array, so the bars replay their grow-in on a fresh run and
  // stay put when only the target moves across them.
  const [prevCounts, setPrevCounts] = useState(counts)
  const [version, setVersion] = useState(0)
  if (prevCounts !== counts) {
    setPrevCounts(counts)
    setVersion((v) => v + 1)
  }

  const tallest = Math.max(...counts, 1)
  const lo = edges[0]
  const hi = edges[edges.length - 1]

  // Positions are logarithmic to match the geometric bins the API returns, so
  // every bar comes out the same width on screen. That also keeps the shaded
  // fraction of the shape honest as a probability: equal widths mean the
  // coloured area is proportional to the count it represents.
  const logLo = Math.log(lo)
  const logSpan = Math.log(hi) - logLo || 1
  const x = (value) => PAD.left + ((Math.log(value) - logLo) / logSpan) * IW
  const barHeight = (count) => (count / tallest) * IH

  const inRange = (value) => value >= lo && value <= hi

  return (
    <svg
      className="hist"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Distribution of simulated final balances, with ${moneyCompact(target)} marked`}
    >
      <g key={version}>
        {counts.map((count, i) => {
          const left = x(edges[i])
          const right = x(edges[i + 1])
          const h = barHeight(count)
          // Geometric midpoint, since the bin itself is geometric: the
          // arithmetic mean of a log bin sits off-centre on screen.
          const midpoint = Math.sqrt(edges[i] * edges[i + 1])

          return (
            <rect
              key={i}
              x={left}
              // A hairline gap keeps the bars legible without a stroke, which
              // would sit half outside the bar and skew the widths.
              width={Math.max(right - left - 1, 0.5)}
              y={PAD.top + IH - h}
              height={h}
              className={midpoint >= target ? 'hist-bar hist-bar-hit' : 'hist-bar'}
              style={{ '--i': i }}
            />
          )
        })}
      </g>

      <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + IH} y2={PAD.top + IH} className="hist-base" />

      {/* The two labels are parked at deliberately different heights. Both sit
          over the bars, and when the median lands near the target — which it
          does whenever the odds are close to even — labels on the same line
          would collide. */}
      {inRange(target) && (
        <g className="hist-mark hist-mark-target">
          <line x1={x(target)} x2={x(target)} y1={PAD.top - 4} y2={PAD.top + IH} />
          <text x={x(target)} y={PAD.top - 7} textAnchor="middle">
            target
          </text>
        </g>
      )}

      {inRange(median) && (
        <g className="hist-mark hist-mark-median">
          <line x1={x(median)} x2={x(median)} y1={PAD.top} y2={PAD.top + IH} />
          <text x={x(median)} y={PAD.top + 18} textAnchor="middle">
            median
          </text>
        </g>
      )}

      {/* Three labels rather than five: at this width five collided. */}
      {[0, 0.5, 1].map((f) => (
        <text
          key={f}
          x={PAD.left + f * IW}
          y={H - 8}
          className="chart-tick"
          textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
        >
          {moneyCompact(Math.exp(logLo + f * logSpan))}
        </text>
      ))}
    </svg>
  )
}
