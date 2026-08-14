import { describe, expect, it } from 'vitest'
import { createApi } from '../server/api.js'

/* Endpoint-level tests for the commerce surface. These exercise the API through
   real Request objects, so routing, validation and the pricing engine are checked
   together — the combination is where price tampering would actually be attempted. */

const silent = { info() {}, error() {} }
const post = (path, body) => new Request(`https://api.motion.test${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
const read = async (response) => ({ status: response.status, ...(await response.json()) })

const product = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Pull-up banner', slug: 'pull-up-banner', status: 'published',
  pricing_type: 'configurable', currency: 'UGX', starting_price: '180000',
  quote_required: false, min_quantity: 1, max_quantity: 100,
}

/* A fake database that answers the queries loadPricingContext issues, matched by
   the table each statement names. */
function database({ products = [product], values = [], components = [], assignments = [] } = {}) {
  const seen = []
  return {
    seen,
    query: async (statement, params) => {
      seen.push({ statement, params })
      if (statement.includes('FROM public.products')) return products
      if (statement.includes('product_option_assignments a\n              JOIN') || statement.includes('FROM public.product_option_assignments')) return assignments
      if (statement.includes('FROM public.product_option_values')) return values
      if (statement.includes('FROM public.pricing_rules')) return components
      return []
    },
  }
}

describe('POST /api/pricing/calculate', () => {
  it('prices a configuration from the database, not from the request', async () => {
    const api = createApi({ db: database(), logger: silent })
    const result = await read(await api(post('/api/pricing/calculate', { slug: 'pull-up-banner', quantity: 3, selection: {} })))
    expect(result.status).toBe(200)
    expect(result.data.total).toBe('540000')
    expect(result.data.currency).toBe('UGX')
  })

  it('ignores a price, total or unit price injected into the request', async () => {
    const api = createApi({ db: database(), logger: silent })
    const attack = await read(await api(post('/api/pricing/calculate', {
      slug: 'pull-up-banner', quantity: 1, selection: {},
      price: 1, total: 1, unitPrice: 1, starting_price: 1, amount: 1,
    })))
    // The banner still costs its real price; nothing from the body reached the maths.
    expect(attack.data.total).toBe('180000')
  })

  it('rejects a quantity outside the product bounds', async () => {
    const api = createApi({ db: database(), logger: silent })
    expect((await read(await api(post('/api/pricing/calculate', { slug: 'pull-up-banner', quantity: 500, selection: {} })))).status).toBe(422)
    expect((await read(await api(post('/api/pricing/calculate', { slug: 'pull-up-banner', quantity: 0, selection: {} })))).status).toBe(422)
    expect((await read(await api(post('/api/pricing/calculate', { slug: 'pull-up-banner', quantity: -3, selection: {} })))).status).toBe(422)
    expect((await read(await api(post('/api/pricing/calculate', { slug: 'pull-up-banner', quantity: 2.7, selection: {} })))).status).toBe(422)
  })

  it('never prices an unpublished product', async () => {
    const api = createApi({ db: database({ products: [] }), logger: silent })
    const result = await read(await api(post('/api/pricing/calculate', { slug: 'draft-item', quantity: 1, selection: {} })))
    expect(result.status).toBe(404)
    // The query filters on status, so a draft is indistinguishable from missing.
    expect(result.error.message).toMatch(/not found/i)
  })

  it('requires a product identifier', async () => {
    const api = createApi({ db: database(), logger: silent })
    expect((await read(await api(post('/api/pricing/calculate', { quantity: 1, selection: {} })))).status).toBe(422)
  })
})

describe('POST /api/cart/validate', () => {
  it('reprices every line and reports a stale total', async () => {
    const api = createApi({ db: database(), logger: silent })
    const result = await read(await api(post('/api/cart/validate', {
      items: [{ key: 'a', productId: product.id, quantity: 2, selection: {}, total: '1' }],
    })))
    expect(result.status).toBe(200)
    expect(result.data.items[0].total).toBe('360000')
    expect(result.data.items[0].priceChanged).toBe(true)
    // A cart holding a wrong price is not valid to check out.
    expect(result.data.valid).toBe(false)
  })

  it('accepts a cart whose stored totals still agree with the server', async () => {
    const api = createApi({ db: database(), logger: silent })
    const result = await read(await api(post('/api/cart/validate', {
      items: [{ key: 'a', productId: product.id, quantity: 2, selection: {}, total: '360000' }],
    })))
    expect(result.data.valid).toBe(true)
    expect(result.data.subtotal).toBe('360000')
  })

  it('marks a withdrawn product unavailable without failing the whole cart', async () => {
    let call = 0
    const db = {
      query: async (statement) => {
        if (statement.includes('FROM public.products')) { call += 1; return call === 1 ? [product] : [] }
        return []
      },
    }
    const api = createApi({ db, logger: silent })
    const result = await read(await api(post('/api/cart/validate', {
      items: [
        { key: 'a', productId: product.id, quantity: 1, selection: {} },
        { key: 'b', productId: '22222222-2222-4222-8222-222222222222', quantity: 1, selection: {} },
      ],
    })))
    expect(result.data.items[0].available).toBe(true)
    expect(result.data.items[1].available).toBe(false)
    expect(result.data.items[1].reason).toMatch(/no longer available/i)
    expect(result.data.valid).toBe(false)
    // Subtotal is withheld rather than reported for a partial cart.
    expect(result.data.subtotal).toBeNull()
  })

  it('keeps a quote-only configuration out of the purchasable cart', async () => {
    const api = createApi({
      db: database({ products: [{ ...product, quote_required: true, pricing_type: 'quote_only' }] }),
      logger: silent,
    })
    const result = await read(await api(post('/api/cart/validate', {
      items: [{ key: 'a', productId: product.id, quantity: 1, selection: {}, total: '180000' }],
    })))
    expect(result.data.items[0].purchasable).toBe(false)
    expect(result.data.items[0].total).toBeNull()
    expect(result.data.valid).toBe(false)
  })

  it('prices the same product twice when its configuration differs', async () => {
    const api = createApi({ db: database(), logger: silent })
    const result = await read(await api(post('/api/cart/validate', {
      items: [
        { key: 'a', productId: product.id, quantity: 1, selection: { size: 'small' } },
        { key: 'b', productId: product.id, quantity: 4, selection: { size: 'large' } },
      ],
    })))
    expect(result.data.items).toHaveLength(2)
    expect(result.data.items[0].total).toBe('180000')
    expect(result.data.items[1].total).toBe('720000')
    expect(result.data.subtotal).toBe('900000')
  })

  it('caps cart size rather than accepting an unbounded payload', async () => {
    const api = createApi({ db: database(), logger: silent })
    const items = Array.from({ length: 80 }, (_, i) => ({ key: `k${i}`, productId: product.id, quantity: 1, selection: {} }))
    expect((await read(await api(post('/api/cart/validate', { items })))).status).toBe(422)
  })
})
