import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { sanitizeNumeric } from '@/lib/format'

/**
 * A numeric field that deliberately avoids <input type="number">: that element
 * brings step validation, spinner buttons, scroll-wheel value changes and
 * inconsistent mobile keyboards. Plain text plus inputMode gives the numeric
 * keypad on phones and nothing else. That is why this uses a bare <input>
 * rather than the shadcn Input, whose sizing assumes a full-width control.
 */
export default function Field({ label, prefix, suffix, value, onChange, min, max, step, sliderMax }) {
  const numeric = parseFloat(value)
  const safe = Number.isFinite(numeric) ? numeric : min
  const id = label.toLowerCase().replace(/\s+/g, '-')
  const top = sliderMax ?? max

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-muted-foreground text-sm font-normal">
          {label}
        </Label>

        <div className="border-input bg-background focus-within:border-ring flex min-w-0 items-center rounded-md border px-2.5 py-1.5 transition-colors">
          {prefix && <span className="text-muted-foreground font-mono text-sm">{prefix}</span>}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(sanitizeNumeric(e.target.value))}
            onBlur={() => {
              if (value === '' || !Number.isFinite(numeric)) return onChange(String(min))
              onChange(String(Math.min(Math.max(numeric, min), max)))
            }}
            // 16px keeps iOS from zooming the page when the field takes focus,
            // and the value stays selectable while the panel around it is not.
            className="w-[6.5ch] min-w-0 border-0 bg-transparent p-0 text-right font-mono text-[16px] tabular-nums outline-none select-text"
          />
          {suffix && <span className="text-muted-foreground font-mono text-sm">{suffix}</span>}
        </div>
      </div>

      <Slider
        value={[Math.min(Math.max(safe, min), top)]}
        onValueChange={([next]) => onChange(String(next))}
        min={min}
        max={top}
        step={step}
        aria-label={`${label} slider`}
      />
    </div>
  )
}
