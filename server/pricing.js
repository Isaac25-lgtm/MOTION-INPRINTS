import { ApiError } from './http.js'
import { CURRENCY, add, isAmount, mulQuantity, toAmount, toWire } from './money.js'

/* The pricing engine (Prompt 5.3).

   `calculatePrice` is a pure function: it takes a product, its option definitions
   and its pricing components, and returns an itemised breakdown. No database, no
   clock, no randomness — which is what makes every rule here directly testable.

   Composition order, highest priority first within each kind:

     base            one component; the starting amount for a single unit
     quantity_tier   replaces the base when the quantity falls in its range
     surcharge_fixed adds once, regardless of quantity
     surcharge_per_unit adds per unit

   A component applies only when every entry in its `applies_when` map matches the
   customer's selection. The most specific matching tier wins.

   Nothing here reads a price from the caller. The browser sends a configuration;
   the server decides what it costs. */

const asInt = (value) => (Number.isSafeInteger(Number(value)) ? Number(value) : null)

/** Does this component's `applies_when` match the selection? */
function matches(appliesWhen, selection) {
  const conditions = Object.entries(appliesWhen || {})
  return conditions.every(([optionCode, expected]) => {
    const chosen = selection[optionCode]
    if (Array.isArray(expected)) return expected.includes(chosen)
    return chosen === expected
  })
}

/** More conditions means more specific; ties break on the stored priority. */
const specificity = (component) => Object.keys(component.applies_when || {}).length

function bestMatch(components, selection, quantity) {
  const eligible = components
    .filter(component => component.is_active !== false)
    .filter(component => matches(component.applies_when, selection))
    .filter(component => (component.min_quantity == null || quantity >= component.min_quantity)
      && (component.max_quantity == null || quantity <= component.max_quantity))
  if (!eligible.length) return null
  return eligible.sort((a, b) => (specificity(b) - specificity(a)) || ((b.priority || 0) - (a.priority || 0)))[0]
}

/**
 * @param {object} input
 * @param {object} input.product        products row
 * @param {object[]} input.options      option definitions with their values
 * @param {object[]} input.components   pricing_rules rows
 * @param {Record<string,string>} input.selection  chosen option values by option code
 * @param {number} input.quantity
 * @returns {{quoteRequired: boolean, reasons: string[], quantity: number,
 *            components: {label: string, kind: string, amount: string}[],
 *            subtotal: string|null, total: string|null, unitPrice: string|null, currency: string}}
 */
export function calculatePrice({ product, options = [], components = [], compatibilityRules = [], selection = {}, quantity = 1 }) {
  const reasons = []
  const quantityValue = asInt(quantity)

  if (quantityValue === null || quantityValue < 1) {
    throw new ApiError(422, 'invalid_quantity', 'Quantity must be a whole number of one or more.')
  }
  const min = product.min_quantity || 1
  const max = product.max_quantity || null
  if (quantityValue < min) throw new ApiError(422, 'below_minimum_quantity', `The minimum order for this item is ${min}.`)
  if (max !== null && quantityValue > max) throw new ApiError(422, 'above_maximum_quantity', `The maximum order for this item is ${max}.`)

  // Required options must be answered, and every answer must be a value that
  // actually belongs to that option. This is the compatibility check.
  const selected = {}
  for (const option of options) {
    const chosen = selection[option.code]
    if (chosen === undefined || chosen === null || chosen === '') {
      if (option.is_required) throw new ApiError(422, 'missing_option', `Choose a ${option.name.toLowerCase()} before continuing.`, { [option.code]: ['This choice is required.'] })
      continue
    }
    if (option.input_type === 'number') {
      const numeric = asInt(chosen)
      if (numeric === null) throw new ApiError(422, 'invalid_option', `${option.name} must be a number.`, { [option.code]: ['Enter a number.'] })
      selected[option.code] = numeric
      continue
    }
    if (option.input_type === 'boolean') { selected[option.code] = chosen === true || chosen === 'true'; continue }
    if (option.input_type === 'text') { selected[option.code] = String(chosen).slice(0, 500); continue }

    const value = (option.values || []).find(candidate => candidate.value === chosen && candidate.is_active !== false)
    if (!value) throw new ApiError(422, 'invalid_option', `That ${option.name.toLowerCase()} is not available.`, { [option.code]: ['Choose one of the listed options.'] })
    selected[option.code] = value.value
    if (value.requires_quote) reasons.push(`${option.name}: ${value.label} is priced per job.`)
  }

  // Cross-option compatibility is data, not product-specific code. A rule only
  // rejects the selection when its prerequisite and disallowed maps both match.
  const conflict = compatibilityRules
    .filter(rule => rule.is_active !== false)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .find(rule => matches(rule.when_selection, selected) && matches(rule.disallow_selection, selected))
  if (conflict) {
    throw new ApiError(422, 'incompatible_options', conflict.message, Object.fromEntries(
      Object.keys(conflict.disallow_selection || {}).map(code => [code, [conflict.message]]),
    ))
  }

  // A product may be quote-only outright.
  if (product.quote_required || product.pricing_type === 'quote_only') {
    reasons.unshift('This product is quoted individually.')
  }

  const byKind = (kind) => components.filter(component => component.component_type === kind)

  // Any matching component flagged requires_quote makes the whole configuration
  // a quotation rather than a purchase.
  for (const component of components) {
    if (!component.requires_quote || component.is_active === false) continue
    if (matches(component.applies_when, selected)) reasons.push(component.label || 'This combination is priced per job.')
  }

  const lines = []

  // Base, or the tier that supersedes it.
  const tier = bestMatch(byKind('quantity_tier'), selected, quantityValue)
  const base = bestMatch(byKind('base'), selected, quantityValue)
  const anchor = tier || base

  if (anchor) {
    const amount = toAmount(anchor.price)
    if (isAmount(amount)) {
      // A tier states the price for the whole run; a base states it per unit.
      const lineTotal = anchor.component_type === 'quantity_tier' ? amount : mulQuantity(amount, quantityValue)
      lines.push({ label: anchor.label || product.name, kind: anchor.component_type, amount: lineTotal })
    }
  } else if (!reasons.length) {
    const starting = toAmount(product.starting_price)
    if (isAmount(starting)) lines.push({ label: product.name, kind: 'base', amount: mulQuantity(starting, quantityValue) })
    else reasons.push('This configuration has no published price.')
  }

  // Surcharges declared on the chosen option values.
  for (const option of options) {
    const chosen = selected[option.code]
    const value = (option.values || []).find(candidate => candidate.value === chosen)
    if (!value) continue
    const surcharge = toAmount(value.surcharge)
    if (!isAmount(surcharge) || surcharge === 0) continue
    lines.push({
      label: `${option.name}: ${value.label}`,
      kind: value.surcharge_kind === 'per_unit' ? 'surcharge_per_unit' : 'surcharge_fixed',
      amount: value.surcharge_kind === 'per_unit' ? mulQuantity(surcharge, quantityValue) : surcharge,
    })
  }

  // Surcharges declared as pricing components. Every matching one applies —
  // unlike the base, these accumulate.
  for (const kind of ['surcharge_fixed', 'surcharge_per_unit']) {
    for (const component of byKind(kind)) {
      if (component.is_active === false || component.requires_quote) continue
      if (!matches(component.applies_when, selected)) continue
      if ((component.min_quantity != null && quantityValue < component.min_quantity)
        || (component.max_quantity != null && quantityValue > component.max_quantity)) continue
      const amount = toAmount(component.price)
      if (!isAmount(amount)) continue
      lines.push({
        label: component.label || 'Additional work',
        kind,
        amount: kind === 'surcharge_per_unit' ? mulQuantity(amount, quantityValue) : amount,
      })
    }
  }

  const quoteRequired = reasons.length > 0
  const subtotal = quoteRequired ? null : add(...lines.map(line => line.amount))

  return {
    quoteRequired,
    reasons,
    quantity: quantityValue,
    selection: selected,
    components: lines.map(line => ({ ...line, amount: toWire(line.amount) })),
    subtotal: toWire(subtotal),
    // Discounts and delivery are applied above this layer; for a single line
    // item the total is the subtotal.
    total: toWire(subtotal),
    unitPrice: quoteRequired || subtotal === null ? null : toWire(Math.round(subtotal / quantityValue)),
    currency: product.currency || CURRENCY,
  }
}

/** Loads everything the engine needs for one product, by id or slug. */
export async function loadPricingContext(db, { productId, slug }) {
  const products = productId
    ? await db.query('SELECT * FROM public.products WHERE id=$1 AND status=$2', [productId, 'published'])
    : await db.query('SELECT * FROM public.products WHERE slug=$1 AND status=$2', [slug, 'published'])
  const product = products[0]
  if (!product) throw new ApiError(404, 'not_found', 'Product not found.')

  const [assignments, values, components, compatibilityRules] = await Promise.all([
    db.query(`SELECT o.id, o.code, o.name, o.input_type, a.is_required, a.sort_order, a.group_label, a.help_text, a.default_value
              FROM public.product_option_assignments a
              JOIN public.product_options o ON o.id = a.option_id
              WHERE a.product_id = $1 ORDER BY a.sort_order, o.name`, [product.id]),
    db.query(`SELECT v.id, v.option_id, v.value, v.label, v.sort_order, v.surcharge, v.surcharge_kind, v.requires_quote, v.is_active
              FROM public.product_option_values v
              JOIN public.product_option_assignments a ON a.option_id = v.option_id
              WHERE a.product_id = $1 ORDER BY v.sort_order, v.label`, [product.id]),
    db.query('SELECT * FROM public.pricing_rules WHERE product_id = $1 AND is_active = true ORDER BY priority DESC', [product.id]),
    db.query('SELECT when_selection, disallow_selection, message, priority, is_active FROM public.product_option_compatibility_rules WHERE product_id = $1 AND is_active = true ORDER BY priority DESC', [product.id]),
  ])

  const options = assignments.map(assignment => ({
    ...assignment,
    values: values.filter(value => value.option_id === assignment.id),
  }))

  return { product, options, components, compatibilityRules }
}
