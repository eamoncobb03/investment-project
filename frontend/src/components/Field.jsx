import Hint from '@/components/Hint'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { sanitizeNumeric } from '@/lib/format'

/**
 * Settles a number field after an interaction: an idle caret goes to the end of
 * the value, so these boxes edit like a calculator entry, where a backspace
 * takes the rightmost digit and a typed digit lands on the right. Where the
 * pointer fell between two numerals is rarely what anyone meant by it.
 *
 * Deferred by a task because the browser places its own caret as part of the
 * default action, which runs after these handlers; a timeout rather than
 * requestAnimationFrame, which does not run in a background tab and would
 * leave the caret stranded mid-number.
 *
 * An actual selection is left as it is. Dragging across the value, double
 * clicking it or hitting select all are all deliberate ways of saying "replace
 * this", and collapsing them to a caret would take that away.
 */
function settleCaret(field) {
  setTimeout(() => {
    if (field.selectionStart === field.selectionEnd) {
      const end = field.value.length
      field.setSelectionRange(end, end)
    }
    field.style.caretColor = ''
  }, 0)
}

/**
 * Hides the caret for the duration of a press, and settles it once the press
 * ends.
 *
 * The obvious fix for the caret being drawn at the pointer and then jumping to
 * the end is to cancel the press outright, so it is never placed wrongly in the
 * first place. That works, and it also cancels every selection gesture the
 * field has: drag, double click, and the click that normally precedes a select
 * all. Hiding the caret instead lets the browser do all of that as usual, and
 * simply never paints the one position we are about to move away from.
 *
 * The release is watched on the window rather than the field, because a press
 * that starts in the field and ends outside it would otherwise leave the caret
 * hidden for good.
 */
function pinCaretOnPress(event) {
  const field = event.currentTarget
  field.style.caretColor = 'transparent'

  const release = () => settleCaret(field)
  window.addEventListener('pointerup', release, { once: true })
  window.addEventListener('pointercancel', release, { once: true })
}

/**
 * A numeric field that deliberately avoids <input type="number">: that element
 * brings step validation, spinner buttons, scroll-wheel value changes and
 * inconsistent mobile keyboards. Plain text plus inputMode gives the numeric
 * keypad on phones and nothing else. That is why this uses a bare <input>
 * rather than the shadcn Input, whose sizing assumes a full-width control.
 */
export default function Field({
  label,
  prefix,
  suffix,
  value,
  onChange,
  min,
  max,
  step,
  sliderMax,
  // Seven-figure values overflow the default width and get clipped mid-number.
  wide,
  hint,
}) {
  const numeric = parseFloat(value)
  const safe = Number.isFinite(numeric) ? numeric : min
  const id = label.toLowerCase().replace(/\s+/g, '-')
  const top = sliderMax ?? max

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5">
          <Label htmlFor={id} className="text-muted-foreground text-sm font-normal">
            {label}
          </Label>
          {hint && <Hint label={`What ${label.toLowerCase()} means`}>{hint}</Hint>}
        </span>

        <div className="border-input bg-background focus-within:border-ring flex min-w-0 items-center rounded-md border px-2.5 py-1.5 transition-colors">
          {prefix && <span className="text-muted-foreground font-mono text-sm">{prefix}</span>}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(sanitizeNumeric(e.target.value))}
            // Both, because neither covers the other: focus does not fire when
            // clicking a field that already holds it, and a press is not
            // involved when focus arrives by keyboard.
            onPointerDown={pinCaretOnPress}
            onFocus={(e) => settleCaret(e.currentTarget)}
            onBlur={() => {
              if (value === '' || !Number.isFinite(numeric)) return onChange(String(min))
              onChange(String(Math.min(Math.max(numeric, min), max)))
            }}
            // 16px keeps iOS from zooming the page when the field takes focus,
            // and the value stays selectable while the panel around it is not.
            className={`${wide ? 'w-[9.5ch]' : 'w-[6.5ch]'} min-w-0 border-0 bg-transparent p-0 text-right font-mono text-[16px] tabular-nums outline-none select-text`}
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
