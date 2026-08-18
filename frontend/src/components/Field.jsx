import { sanitizeNumeric } from '../lib/format'

/**
 * A numeric field that deliberately avoids <input type="number">: that element
 * brings step validation, spinner buttons, scroll-wheel value changes and
 * inconsistent mobile keyboards. Plain text plus inputMode gives the numeric
 * keypad on phones and nothing else.
 */
export default function Field({ label, prefix, suffix, value, onChange, min, max, step, sliderMax }) {
  const numeric = parseFloat(value)
  const safe = Number.isFinite(numeric) ? numeric : min

  return (
    <div className="field">
      <div className="field-head">
        <label className="field-label" htmlFor={label}>
          {label}
        </label>
        <div className="field-input">
          {prefix && <span className="field-affix">{prefix}</span>}
          <input
            id={label}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(sanitizeNumeric(e.target.value))}
            onBlur={() => {
              if (value === '' || !Number.isFinite(numeric)) return onChange(String(min))
              onChange(String(Math.min(Math.max(numeric, min), max)))
            }}
          />
          {suffix && <span className="field-affix">{suffix}</span>}
        </div>
      </div>

      <input
        className="field-slider"
        type="range"
        min={min}
        max={sliderMax ?? max}
        step={step}
        value={Math.min(Math.max(safe, min), sliderMax ?? max)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} slider`}
      />
    </div>
  )
}
