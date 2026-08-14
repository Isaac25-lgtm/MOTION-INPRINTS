/* Price display.

   Motion trades in UGX, which is used in whole shillings — so amounts are
   formatted with no decimal places. A product with no verified price is never
   shown a number: it shows its quote status instead. Nothing here invents a value. */

const formatter = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 })

export function formatAmount(amount, currency = 'UGX') {
  if (amount === null || amount === undefined || amount === '') return null
  const value = Number(amount)
  if (!Number.isFinite(value)) return null
  if (currency === 'UGX') return formatter.format(value)
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

export function Price({ amount, currency = 'UGX', pricingType, quoteRequired, from = true }) {
  const formatted = formatAmount(amount, currency)
  if (quoteRequired || pricingType === 'quote_only' || !formatted) {
    return <p className="t-price t-price--quote">Request a quote</p>
  }
  return (
    <p className="t-price">
      {from && pricingType === 'configurable' && <span className="t-meta" style={{ marginInlineEnd: '0.35rem' }}>From</span>}
      {formatted}
    </p>
  )
}
