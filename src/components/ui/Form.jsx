import { useId } from 'react'
import { Icon } from './Icon'

/* Every control is labelled, describes its own hint and error, and marks
   invalidity for assistive technology — not by colour alone. */
function useFieldIds(id, hint, error) {
  const generated = useId()
  const fieldId = id || generated
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  return { fieldId, hintId, errorId, describedBy: [hintId, errorId].filter(Boolean).join(' ') || undefined }
}

function Label({ htmlFor, children, optional }) {
  return (
    <label className="field__label" htmlFor={htmlFor}>
      {children}
      {optional && <span className="field__optional"> (optional)</span>}
    </label>
  )
}

export function Field({ label, hint, error, optional, id, as = 'input', children, ...rest }) {
  const { fieldId, hintId, errorId, describedBy } = useFieldIds(id, hint, error)
  const Control = as === 'textarea' ? 'textarea' : 'input'
  return (
    <div className="field">
      <Label htmlFor={fieldId} optional={optional}>{label}</Label>
      {hint && <p className="field__hint" id={hintId}>{hint}</p>}
      {children || (
        <Control
          id={fieldId}
          className={as === 'textarea' ? 'textarea' : 'input'}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          {...rest}
        />
      )}
      {error && <p className="field__error" id={errorId} role="alert">{error}</p>}
    </div>
  )
}

export function SelectField({ label, hint, error, optional, id, options = [], ...rest }) {
  const { fieldId, hintId, errorId, describedBy } = useFieldIds(id, hint, error)
  return (
    <div className="field">
      <Label htmlFor={fieldId} optional={optional}>{label}</Label>
      {hint && <p className="field__hint" id={hintId}>{hint}</p>}
      <select id={fieldId} className="select" aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined} {...rest}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {error && <p className="field__error" id={errorId} role="alert">{error}</p>}
    </div>
  )
}

export function ChoiceGroup({ legend, name, options = [], value, onChange, columns = 2 }) {
  return (
    <fieldset className="stack" style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend className="field__label" style={{ padding: 0 }}>{legend}</legend>
      <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${columns > 1 ? '12rem' : '100%'}, 1fr))`, gap: 'var(--space-2)' }}>
        {options.map(option => (
          <label className="choice" key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="t-body-sm">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function QuantityControl({ value, onChange, min = 1, max = 100000, label = 'Quantity' }) {
  const id = useId()
  const clamp = (next) => Math.min(Math.max(next, min), max)
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <div className="quantity">
        <button type="button" onClick={() => onChange(clamp(value - 1))} aria-label="Decrease quantity" disabled={value <= min}>
          <Icon name="minus" size={16} />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(clamp(Number(event.target.value) || min))}
        />
        <button type="button" onClick={() => onChange(clamp(value + 1))} aria-label="Increase quantity" disabled={value >= max}>
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  )
}
