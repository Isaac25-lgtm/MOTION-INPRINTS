import { describe, expect, it } from 'vitest'
import { calculatePrice } from '../server/pricing.js'
import { ApiError } from '../server/http.js'
import { add, mulQuantity, mulRate, toAmount } from '../server/money.js'

/* The pricing engine is the one place a customer can be overcharged or a job
   under-quoted, so it is tested against the brief's own worked examples. */

const businessCards = {
  product: { id: 'p1', name: 'Business cards', pricing_type: 'configurable', currency: 'UGX', min_quantity: 100, max_quantity: 10000, starting_price: null, quote_required: false },
  options: [
    { code: 'quantity_pack', name: 'Pack size', input_type: 'select', is_required: true, values: [
      { value: '100', label: '100 cards' }, { value: '250', label: '250 cards' }, { value: '500', label: '500 cards' },
    ] },
    { code: 'sides', name: 'Printed sides', input_type: 'select', is_required: true, values: [
      { value: 'single', label: 'Single sided' },
      { value: 'double', label: 'Double sided', surcharge: '15000', surcharge_kind: 'fixed' },
    ] },
    { code: 'finish', name: 'Finish', input_type: 'select', is_required: false, values: [
      { value: 'none', label: 'None' },
      { value: 'matte', label: 'Matte lamination', surcharge: '20000', surcharge_kind: 'fixed' },
    ] },
    { code: 'design', name: 'Design service', input_type: 'boolean', is_required: false, values: [] },
  ],
  components: [
    { component_type: 'quantity_tier', label: '100 cards', price: '90000', min_quantity: 100, max_quantity: 100, applies_when: {}, priority: 10, is_active: true },
    { component_type: 'quantity_tier', label: '250 cards', price: '150000', min_quantity: 101, max_quantity: 250, applies_when: {}, priority: 10, is_active: true },
    { component_type: 'quantity_tier', label: '500 cards', price: '240000', min_quantity: 251, max_quantity: 500, applies_when: {}, priority: 10, is_active: true },
    { component_type: 'surcharge_fixed', label: 'Design service', price: '80000', applies_when: { design: true }, priority: 5, is_active: true },
  ],
}

const tshirts = {
  product: { id: 'p2', name: 'Branded T-shirt', pricing_type: 'configurable', currency: 'UGX', min_quantity: 10, max_quantity: null, starting_price: '25000', quote_required: false },
  options: [
    { code: 'branding', name: 'Branding method', input_type: 'select', is_required: true, values: [
      { value: 'print', label: 'Screen print', surcharge: '3000', surcharge_kind: 'per_unit' },
      { value: 'embroidery', label: 'Embroidery', surcharge: '6500', surcharge_kind: 'per_unit' },
      { value: 'special', label: 'Specialist finish', requires_quote: true },
    ] },
    { code: 'colour', name: 'Garment colour', input_type: 'select', is_required: true, values: [
      { value: 'white', label: 'White' }, { value: 'black', label: 'Black' },
    ] },
  ],
  components: [
    { component_type: 'base', label: 'Garment', price: '25000', applies_when: {}, priority: 0, is_active: true },
    { component_type: 'surcharge_fixed', label: 'Setup', price: '40000', applies_when: { branding: 'embroidery' }, priority: 0, is_active: true },
  ],
}

const calc = (fixture, selection, quantity) => calculatePrice({ ...fixture, selection, quantity })

describe('pricing engine', () => {
  it('prices the brief\'s business-card example: 100 + matte + double-sided', () => {
    const result = calc(businessCards, { quantity_pack: '100', sides: 'double', finish: 'matte' }, 100)
    // 90,000 tier + 15,000 double-sided + 20,000 matte
    expect(result.total).toBe('125000')
    expect(result.quoteRequired).toBe(false)
    expect(result.components.map(c => c.amount)).toEqual(['90000', '15000', '20000'])
  })

  it('selects the tier the quantity actually falls in', () => {
    expect(calc(businessCards, { quantity_pack: '100', sides: 'single' }, 100).total).toBe('90000')
    expect(calc(businessCards, { quantity_pack: '250', sides: 'single' }, 250).total).toBe('150000')
    expect(calc(businessCards, { quantity_pack: '500', sides: 'single' }, 500).total).toBe('240000')
    // A tier prices the whole run, so it must not be multiplied by quantity.
    expect(calc(businessCards, { quantity_pack: '500', sides: 'single' }, 500).components[0].amount).toBe('240000')
  })

  it('prices the brief\'s T-shirt example: 20 shirts with embroidery', () => {
    const result = calc(tshirts, { branding: 'embroidery', colour: 'black' }, 20)
    // (25,000 base + 6,500 embroidery) x 20 + 40,000 setup
    expect(result.total).toBe('670000')
    expect(result.unitPrice).toBe('33500')
  })

  it('multiplies a per-unit surcharge but not a fixed one', () => {
    const ten = calc(tshirts, { branding: 'print', colour: 'white' }, 10)
    const twenty = calc(tshirts, { branding: 'print', colour: 'white' }, 20)
    expect(ten.total).toBe('280000')   // (25,000 + 3,000) x 10
    expect(twenty.total).toBe('560000')
    // Setup is fixed: it appears once at any quantity.
    const embroidered = calc(tshirts, { branding: 'embroidery', colour: 'white' }, 100)
    expect(embroidered.components.filter(c => c.label === 'Setup')).toHaveLength(1)
  })

  it('falls back to a quotation instead of inventing a price', () => {
    const result = calc(tshirts, { branding: 'special', colour: 'white' }, 50)
    expect(result.quoteRequired).toBe(true)
    expect(result.total).toBeNull()
    expect(result.unitPrice).toBeNull()
    expect(result.reasons.join(' ')).toMatch(/priced per job/i)
  })

  it('treats a quote-only product as quote-only whatever the components say', () => {
    const result = calculatePrice({
      ...businessCards,
      product: { ...businessCards.product, quote_required: true, pricing_type: 'quote_only' },
      selection: { quantity_pack: '100', sides: 'single' },
      quantity: 100,
    })
    expect(result.quoteRequired).toBe(true)
    expect(result.total).toBeNull()
  })

  it('enforces quantity bounds', () => {
    expect(() => calc(businessCards, { quantity_pack: '100', sides: 'single' }, 50)).toThrow(/minimum/i)
    expect(() => calc(businessCards, { quantity_pack: '100', sides: 'single' }, 50000)).toThrow(/maximum/i)
    expect(() => calc(businessCards, { quantity_pack: '100', sides: 'single' }, 0)).toThrow(ApiError)
    expect(() => calc(businessCards, { quantity_pack: '100', sides: 'single' }, -5)).toThrow(ApiError)
    expect(() => calc(businessCards, { quantity_pack: '100', sides: 'single' }, 1.5)).toThrow(ApiError)
  })

  it('rejects an option value that does not belong to the product', () => {
    expect(() => calc(businessCards, { quantity_pack: '100', sides: 'quadruple' }, 100)).toThrow(/not available/i)
    // Free-text injection into a select must not slip through.
    expect(() => calc(businessCards, { quantity_pack: '100', sides: "single'; DROP TABLE products;--" }, 100)).toThrow(ApiError)
  })

  it('rejects a database-defined incompatible option combination', () => {
    expect(() => calculatePrice({
      ...tshirts,
      selection: { branding: 'embroidery', colour: 'black' },
      quantity: 20,
      compatibilityRules: [{
        when_selection: { colour: 'black' },
        disallow_selection: { branding: 'embroidery' },
        message: 'Embroidery is unavailable with this garment colour.',
        priority: 10,
        is_active: true,
      }],
    })).toThrow(/unavailable with this garment colour/i)
  })

  it('requires the options marked required', () => {
    expect(() => calc(businessCards, { quantity_pack: '100' }, 100)).toThrow(/printed sides/i)
    // An optional one may be omitted.
    expect(calc(businessCards, { quantity_pack: '100', sides: 'single' }, 100).quoteRequired).toBe(false)
  })

  it('ignores a price supplied by the caller', () => {
    const result = calculatePrice({
      ...businessCards,
      selection: { quantity_pack: '100', sides: 'single', price: '1', total: '1', unit_price: '1' },
      quantity: 100,
    })
    // The engine only reads declared options; injected money keys are inert.
    expect(result.total).toBe('90000')
  })

  it('applies a conditional surcharge only when its condition matches', () => {
    const withDesign = calc(businessCards, { quantity_pack: '100', sides: 'single', design: true }, 100)
    const withoutDesign = calc(businessCards, { quantity_pack: '100', sides: 'single', design: false }, 100)
    expect(withDesign.total).toBe('170000')
    expect(withoutDesign.total).toBe('90000')
  })

  it('ignores inactive components and values', () => {
    const result = calculatePrice({
      ...businessCards,
      components: businessCards.components.map(c => ({ ...c, is_active: false })),
      selection: { quantity_pack: '100', sides: 'single' },
      quantity: 100,
    })
    // No tier applies and the product has no starting price, so it becomes a quote.
    expect(result.quoteRequired).toBe(true)
  })
})

describe('money arithmetic', () => {
  it('never introduces floating-point error', () => {
    // The classic failure: 0.1 + 0.2. Integer shillings cannot express it.
    expect(add(10, 20)).toBe(30)
    expect(mulQuantity(33500, 20)).toBe(670000)
    expect(Number.isInteger(mulQuantity(1, 3))).toBe(true)
  })

  it('applies VAT through basis points rather than float multiplication', () => {
    // 18% of 125,000. `125000 * 0.18` is 22500.000000000004 in float.
    expect(mulRate(125000, 1800)).toBe(22500)
    expect(mulRate(1, 1800)).toBe(0)
    expect(mulRate(3, 1800)).toBe(1) // rounds, never truncates silently
  })

  it('parses database numerics and rejects nonsense', () => {
    expect(toAmount('180000.00')).toBe(180000)
    expect(toAmount(0)).toBe(0)
    expect(toAmount(null)).toBeNull()
    expect(toAmount('')).toBeNull()
    expect(toAmount('abc')).toBeNull()
    expect(toAmount(Infinity)).toBeNull()
  })

  it('refuses a fractional quantity rather than rounding it away', () => {
    expect(() => mulQuantity(1000, 2.5)).toThrow(RangeError)
    expect(() => mulQuantity(1000, -1)).toThrow(RangeError)
  })
})
