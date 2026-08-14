import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { SelectField, Field, QuantityControl } from '../../components/ui/Form'
import { formatAmount } from '../../components/ui/Price'
import { pricingService } from '../../services/cartService'

/* Dynamic product configuration (Prompts 5.2, 5.3).

   Every control is generated from the option definitions the API returns, so this
   one component serves business cards, banners and T-shirts alike. There is no
   `paperSize` or `shirtColour` anywhere in this file — adding a product with new
   options requires no frontend change.

   Options are grouped by their `group_label`, and groups after the first are
   collapsed, which is the progressive disclosure the brief asks for: a customer
   sees size and quantity immediately and finishing detail only if they want it. */

function useDebouncedSelection(selection, quantity, delay = 300) {
  const [settled, setSettled] = useState({ selection, quantity })
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled({ selection, quantity }), delay)
    return () => window.clearTimeout(timer)
  }, [selection, quantity, delay])
  return settled
}

function Control({ option, value, onChange }) {
  const label = option.name
  const hint = option.help_text || undefined

  if (option.input_type === 'boolean') {
    return (
      <label className="choice">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        <span className="t-body-sm">
          {label}
          {hint && <span className="field__hint" style={{ display: 'block' }}>{hint}</span>}
        </span>
      </label>
    )
  }

  if (option.input_type === 'number') {
    return <Field label={label} hint={hint} type="number" inputMode="numeric" value={value ?? ''} optional={!option.is_required} onChange={(event) => onChange(event.target.value)} />
  }

  if (option.input_type === 'text') {
    return <Field label={label} hint={hint} value={value ?? ''} optional={!option.is_required} onChange={(event) => onChange(event.target.value)} />
  }

  return (
    <SelectField
      label={label}
      hint={hint}
      optional={!option.is_required}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      options={[
        { value: '', label: option.is_required ? `Choose ${label.toLowerCase()}…` : 'No preference' },
        ...option.values.map(item => ({
          value: item.value,
          // Surcharges are surfaced so a choice is not a surprise, but the number
          // that counts is the one the server returns below.
          label: item.requires_quote
            ? `${item.label} — quoted`
            : item.surcharge && Number(item.surcharge) > 0
              ? `${item.label} (+${formatAmount(item.surcharge)}${item.surcharge_kind === 'per_unit' ? ' each' : ''})`
              : item.label,
        })),
      ]}
    />
  )
}

export function ProductConfigurator({ product, onAddToCart, adding }) {
  const options = product.options || []

  const [selection, setSelection] = useState(() => Object.fromEntries(
    options.filter(option => option.default_value).map(option => [option.code, option.default_value]),
  ))
  const [quantity, setQuantity] = useState(product.min_quantity || 1)
  const [expanded, setExpanded] = useState(() => new Set())
  const [price, setPrice] = useState({ loading: true, data: null, error: null })
  const requestId = useRef(0)

  const settled = useDebouncedSelection(selection, quantity)

  /* Price comes from the server on every settled change. A stale response from an
     earlier configuration must never overwrite a newer one, hence the request id. */
  useEffect(() => {
    const controller = new AbortController()
    const id = ++requestId.current
    setPrice(current => ({ ...current, loading: true }))
    pricingService.calculate({ slug: product.slug, quantity: settled.quantity, selection: settled.selection }, { signal: controller.signal })
      .then(data => { if (id === requestId.current) setPrice({ loading: false, data, error: null }) })
      .catch(error => {
        if (controller.signal.aborted || error.name === 'AbortError' || id !== requestId.current) return
        setPrice({ loading: false, data: null, error })
      })
    return () => controller.abort()
  }, [product.slug, settled])

  const groups = useMemo(() => {
    const map = new Map()
    for (const option of options) {
      const key = option.group_label || 'Options'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(option)
    }
    return [...map.entries()]
  }, [options])

  const quote = price.data
  const quoteRequired = product.quote_required || product.pricing_type === 'quote_only' || quote?.quoteRequired
  const canAdd = Boolean(quote) && !quote.quoteRequired && !price.loading && !price.error
  const quoteLink = useMemo(() => {
    const params = new URLSearchParams({
      product: product.slug,
      productName: product.name,
      quantity: String(quantity),
      configuration: JSON.stringify(selection),
    })
    return `/custom-project?${params.toString()}`
  }, [product.slug, product.name, quantity, selection])

  const set = (code) => (value) => setSelection(current => ({ ...current, [code]: value }))
  const toggle = (name) => setExpanded(current => {
    const next = new Set(current)
    if (next.has(name)) next.delete(name); else next.add(name)
    return next
  })

  return (
    <div className="stack stack--lg">
      {groups.map(([name, groupOptions], index) => {
        // The first group is always open; later groups are disclosure sections.
        const open = index === 0 || expanded.has(name)
        return (
          <section key={name} className="stack">
            {groups.length > 1 && index > 0 ? (
              <button type="button" className="config-group__toggle" aria-expanded={open} onClick={() => toggle(name)}>
                <span className="t-h4">{name}</span>
                <span aria-hidden="true">{open ? '−' : '+'}</span>
              </button>
            ) : (
              groups.length > 1 && <p className="t-eyebrow">{name}</p>
            )}
            {open && (
              <div className="stack">
                {groupOptions.map(option => (
                  <Control key={option.code} option={option} value={selection[option.code]} onChange={set(option.code)} />
                ))}
              </div>
            )}
          </section>
        )
      })}

      <QuantityControl
        value={quantity}
        onChange={setQuantity}
        min={product.min_quantity || 1}
        max={product.max_quantity || 100000}
        label={`Quantity${product.min_quantity > 1 ? ` (minimum ${product.min_quantity})` : ''}`}
      />

      <div className="price-panel">
        {price.error ? (
          <p className="t-body-sm" role="alert" style={{ color: 'var(--state-error)' }}>{price.error.message}</p>
        ) : quoteRequired ? (
          <>
            <p className="t-price t-price--quote">Request a quote</p>
            {quote?.reasons?.length > 0 && (
              <ul className="stack stack--sm" style={{ marginBlockStart: 'var(--space-2)' }}>
                {quote.reasons.map(reason => <li key={reason} className="t-caption">{reason}</li>)}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="t-price price-panel__total" aria-live="polite" aria-busy={price.loading}>
              {price.loading && !quote ? '—' : formatAmount(quote?.total, quote?.currency)}
            </p>
            {/* The breakdown makes a configured price legible rather than magic. */}
            {quote?.components?.length > 1 && (
              <dl className="price-panel__breakdown">
                {quote.components.map((component, index) => (
                  <div key={`${component.label}-${index}`}>
                    <dt>{component.label}</dt>
                    <dd>{formatAmount(component.amount, quote.currency)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {quote?.unitPrice && quantity > 1 && (
              <p className="t-meta">{formatAmount(quote.unitPrice, quote.currency)} each</p>
            )}
          </>
        )}
      </div>

      {quoteRequired ? (
        <Button
          to={quoteLink}
          variant="primary"
        >
          Request a quote
        </Button>
      ) : (
        <Button
          variant="primary"
          disabled={!canAdd || adding}
          onClick={() => onAddToCart({ selection, quantity, price: quote })}
        >
          {adding ? 'Adding…' : 'Add to cart'}
        </Button>
      )}

      <ArtworkNotice requirement={product.artwork_requirement} />
    </div>
  )
}

/* Artwork expectations are stated before ordering, but nothing is uploaded here —
   the brief is explicit that a customer should not be made to upload files before
   deciding to order (Prompt 5.2). */
function ArtworkNotice({ requirement }) {
  const notices = {
    required: 'Artwork is required for this item. You can upload it during checkout or send it afterwards.',
    optional: 'Send artwork during checkout, or later — whichever suits you.',
    design_available: 'Have artwork ready, or add our design service and we will prepare it for you.',
  }
  const notice = notices[requirement]
  if (!notice) return null
  return <p className="t-caption">{notice}</p>
}
