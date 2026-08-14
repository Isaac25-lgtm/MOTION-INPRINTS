import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../server/http.js'
import { checkIdempotency, createOrder, fingerprintRequest, priceCart, convertQuoteToOrder } from '../server/orders.js'
import { assertAcceptable, acceptQuote, createAccessToken, hashToken, quoteTokenAllowsAccess, tokenMatches, totalQuote, QUOTE_STATUS } from '../server/quotes.js'
import { PAYMENT_STATUS, normaliseStatus, recordWebhookEvent, scrub, verifyAndSettle } from '../server/payments.js'
import { makeReference } from '../server/references.js'

/* Prompt 8.6 — adversarial checks.

   Each test states an attack a customer could actually attempt from a browser or
   an HTTP client, and asserts the server refuses it. These are written against the
   real functions, not mocks of them. */

const product = {
  id: 'p1', name: 'Banner', slug: 'banner', status: 'published', pricing_type: 'fixed',
  currency: 'UGX', starting_price: '100000', quote_required: false, min_quantity: 1, max_quantity: 500,
}

const db = (overrides = {}) => ({
  query: async (statement) => {
    if (statement.includes('FROM public.products')) return [product]
    if (statement.includes('FROM public.pricing_rules')) return []
    if (statement.includes('product_option')) return []
    return []
  },
  transaction: async (build) => build({ query: async () => [] }),
  ...overrides,
})

describe('price tampering', () => {
  it('charges the real price when the browser claims UGX 1 for a UGX 100,000 product', async () => {
    const priced = await priceCart(db(), [{ productId: 'p1', quantity: 1, selection: {}, unitPrice: 1, lineTotal: 1, price: 1 }])
    // Everything the client sent about money is discarded.
    expect(priced.lines[0].lineTotal).toBe(100000)
    expect(priced.subtotal).toBe(100000)
  })

  it('recalculates rather than trusting a manipulated quantity/price pair', async () => {
    const priced = await priceCart(db(), [{ productId: 'p1', quantity: 5, selection: {}, lineTotal: 5 }])
    expect(priced.lines[0].lineTotal).toBe(500000)
  })

  it('records an optional artwork choice without changing the calculated price', async () => {
    const priced = await priceCart(db({
      query: async (statement) => statement.includes('FROM public.products')
        ? [{ ...product, artwork_requirement: 'optional' }]
        : [],
    }), [{ productId: 'p1', quantity: 1, selection: {}, artworkAction: 'upload_later' }])
    expect(priced.lines[0].lineTotal).toBe(100000)
    expect(priced.lines[0].artworkStatus).toBe('awaiting_upload')
  })

  it('refuses to sell a quote-only product through the cart', async () => {
    const quoteOnly = db({
      query: async (statement) => {
        if (statement.includes('FROM public.products')) return [{ ...product, quote_required: true, pricing_type: 'quote_only' }]
        return []
      },
    })
    await expect(priceCart(quoteOnly, [{ productId: 'p1', quantity: 1, selection: {} }]))
      .rejects.toThrow(/quoted rather than ordered/i)
  })

  it('refuses an unpublished product', async () => {
    const withdrawn = db({ query: async () => [] })
    await expect(priceCart(withdrawn, [{ productId: 'p1', quantity: 1, selection: {} }])).rejects.toThrow(ApiError)
  })

  it('rejects a negative or fractional quantity before any pricing happens', async () => {
    await expect(priceCart(db(), [{ productId: 'p1', quantity: -2, selection: {} }])).rejects.toThrow(ApiError)
    await expect(priceCart(db(), [{ productId: 'p1', quantity: 1.5, selection: {} }])).rejects.toThrow(ApiError)
  })
})

describe('duplicate submission', () => {
  const body = { items: [{ productId: 'p1', quantity: 1 }] }

  it('replays a stored response rather than repeating the work', async () => {
    const stored = { reference: 'MOT-ABC234' }
    const store = {
      query: async (statement) => (statement.startsWith('SELECT request_fingerprint')
        ? [{ request_fingerprint: fingerprintRequest(body), response: stored }]
        : []),
    }
    expect(await checkIdempotency(store, { key: 'k1', scope: 'checkout', request: body })).toEqual(stored)
  })

  it('rejects the same key reused with different details', async () => {
    const store = { query: async () => [{ request_fingerprint: 'a-different-fingerprint', response: { reference: 'MOT-AAA222' } }] }
    await expect(checkIdempotency(store, { key: 'k1', scope: 'checkout', request: { different: true } }))
      .rejects.toThrow(/already used with different details/i)
  })

  it('proceeds when the key has never been seen', async () => {
    const store = { query: async () => [] }
    expect(await checkIdempotency(store, { key: 'fresh', scope: 'checkout', request: body })).toBeNull()
  })

  it('writes the order, its items and the idempotency key in a single transaction', async () => {
    /* The previous design created the order first and recorded the key afterwards,
       so a failure between the two allowed a retry to produce a second order.
       Everything must now be in one statement batch. */
    let batch = null
    const store = {
      query: async (statement) => (statement.includes('FROM public.products') ? [product]
        : statement.startsWith('SELECT 1 FROM') ? [] : []),
      transaction: async (build) => { batch = build({ query: (sql, params) => ({ sql, params }) }); return batch.map(() => []) },
    }
    await createOrder(store, {
      items: [{ productId: 'p1', quantity: 2, selection: {} }],
      contact: { name: 'Ada', email: 'ada@example.test' },
      fulfilment: { method: 'collection' },
      idempotency: { key: 'k9', scope: 'checkout', request: body },
    })
    const statements = batch.map(entry => entry.sql)
    expect(statements.some(s => s.includes('INSERT INTO public.orders'))).toBe(true)
    expect(statements.some(s => s.includes('INSERT INTO public.order_items'))).toBe(true)
    expect(statements.some(s => s.includes('INSERT INTO public.order_status_history'))).toBe(true)
    expect(statements.some(s => s.includes('INSERT INTO public.idempotency_keys'))).toBe(true)
  })

  it('resolves a lost race to the winning order instead of creating another', async () => {
    const winner = { reference: 'MOT-WIN222' }
    const store = {
      query: async (statement) => (statement.includes('FROM public.products') ? [product]
        : statement.startsWith('SELECT response') ? [{ response: winner }]
          : statement.startsWith('SELECT 1 FROM') ? [] : []),
      transaction: async () => { throw new Error('duplicate key value violates unique constraint "idempotency_keys_pkey"') },
    }
    const result = await createOrder(store, {
      items: [{ productId: 'p1', quantity: 1, selection: {} }],
      contact: { name: 'Ada', email: 'ada@example.test' },
      fulfilment: { method: 'collection' },
      idempotency: { key: 'k9', scope: 'checkout', request: body },
    })
    expect(result).toEqual(winner)
  })
})

describe('quote lifecycle', () => {
  const sent = { id: 'q1', quote_number: 'MOT-QT-AAA222', status_code: QUOTE_STATUS.sent, valid_until: '2999-01-01', superseded_at: null, customer_accepted_at: null, total_amount: '500000', version: 1 }

  it('accepts a live quote', () => {
    expect(() => assertAcceptable(sent)).not.toThrow()
  })

  it('refuses an expired quote', () => {
    expect(() => assertAcceptable({ ...sent, valid_until: '2020-01-01' })).toThrow(/expired/i)
  })

  it('refuses a superseded quote', () => {
    expect(() => assertAcceptable({ ...sent, superseded_at: new Date().toISOString() })).toThrow(/replaced/i)
  })

  it('refuses to accept twice', () => {
    expect(() => assertAcceptable({ ...sent, customer_accepted_at: new Date().toISOString() })).toThrow(/already been accepted/i)
  })

  it('refuses a quote that was never sent to the customer', () => {
    expect(() => assertAcceptable({ ...sent, status_code: QUOTE_STATUS.prepared })).toThrow(/not open/i)
  })

  it('loses the acceptance race safely rather than double-accepting', async () => {
    // The conditional UPDATE matches no row because another request got there first.
    const store = { query: async () => [] }
    await expect(acceptQuote(store, sent)).rejects.toThrow(/already been accepted/i)
  })

  it('applies tax only when a rate is configured', () => {
    const items = [{ title: 'Sign', quantity: 2, unitPrice: '250000' }]
    expect(totalQuote(items, { taxRateBp: null })).toMatchObject({ subtotal: 500000, tax: 0, total: 500000 })
    expect(totalQuote(items, { taxRateBp: 1800 })).toMatchObject({ subtotal: 500000, tax: 90000, total: 590000 })
  })

  it('rejects a quote line with no price rather than defaulting it to zero', () => {
    expect(() => totalQuote([{ title: 'Sign', quantity: 1, unitPrice: null }])).toThrow(ApiError)
  })

  it('stores guest access tokens hashed, never in plaintext', () => {
    const token = createAccessToken()
    const stored = hashToken(token)
    // A database dump yields hashes, not working links.
    expect(stored).not.toBe(token)
    expect(stored).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenMatches(token, stored)).toBe(true)
    expect(tokenMatches('wrong', stored)).toBe(false)
    expect(tokenMatches('', stored)).toBe(false)
    expect(tokenMatches(null, stored)).toBe(false)
    // The plaintext token is not accepted as though it were the stored hash.
    expect(tokenMatches(token, token)).toBe(false)
  })

  it('issues tokens with enough entropy to resist guessing', () => {
    const tokens = Array.from({ length: 200 }, () => createAccessToken())
    expect(new Set(tokens).size).toBe(200)
    expect(tokens[0].length).toBeGreaterThanOrEqual(43)
  })

  it('rejects expired, revoked and not-yet-activated guest links', () => {
    const token = createAccessToken()
    const active = {
      access_token: hashToken(token),
      access_token_expires_at: '2999-01-01T00:00:00.000Z',
      access_token_revoked_at: null,
    }
    expect(quoteTokenAllowsAccess(active, token)).toBe(true)
    expect(quoteTokenAllowsAccess({ ...active, access_token_expires_at: '2020-01-01T00:00:00.000Z' }, token)).toBe(false)
    expect(quoteTokenAllowsAccess({ ...active, access_token_revoked_at: new Date().toISOString() }, token)).toBe(false)
    expect(quoteTokenAllowsAccess({ ...active, access_token_expires_at: null }, token)).toBe(false)
  })
})

describe('quote to order conversion', () => {
  const accepted = { id: 'q1', quote_number: 'MOT-QT-AAA222', status_code: QUOTE_STATUS.accepted, customer_accepted_at: new Date().toISOString(), superseded_at: null, tax_amount: '0', version: 1, valid_until: '2999-01-01' }
  const contact = { name: 'A', email: 'a@example.test' }

  it('refuses to convert a quote that was never accepted', async () => {
    const pending = { ...accepted, customer_accepted_at: null, status_code: QUOTE_STATUS.sent }
    await expect(convertQuoteToOrder(db(), { quote: pending, items: [], contact })).rejects.toThrow(ApiError)
  })

  it('refuses a second conversion of the same quote', async () => {
    const store = db({ query: async (statement) => (statement.includes('FROM public.orders WHERE quote_id') ? [{ id: 'o1', order_number: 'MOT-AAA222' }] : []) })
    await expect(convertQuoteToOrder(store, { quote: accepted, items: [], contact })).rejects.toThrow(/already exists/i)
  })

  it('refuses a superseded quote even once accepted', async () => {
    await expect(convertQuoteToOrder(db(), { quote: { ...accepted, superseded_at: new Date().toISOString() }, items: [], contact }))
      .rejects.toThrow(/replaced/i)
  })
})

describe('payments', () => {
  const payment = { id: 'pay1', order_id: 'o1', amount: '250000', currency: 'UGX', status: PAYMENT_STATUS.processing, provider: 'test', provider_reference: 'ref-1' }
  const store = (overrides = {}) => ({
    query: async () => [{ ...payment, status: PAYMENT_STATUS.successful }],
    transaction: async (build) => build({ query: async () => [] }),
    ...overrides,
  })

  it('rejects a confirmation whose amount does not match the order', async () => {
    await expect(verifyAndSettle(store(), null, {
      payment,
      confirmation: { status: 'successful', amount: '1', currency: 'UGX' },
    })).rejects.toThrow(/amount does not match/i)
  })

  it('rejects a confirmation in a different currency', async () => {
    await expect(verifyAndSettle(store(), null, {
      payment,
      confirmation: { status: 'successful', amount: '250000', currency: 'USD' },
    })).rejects.toThrow(/currency does not match/i)
  })

  it('treats an unknown provider status as failure, never as success', () => {
    expect(normaliseStatus('who-knows')).toBe(PAYMENT_STATUS.failed)
    expect(normaliseStatus(undefined)).toBe(PAYMENT_STATUS.failed)
    expect(normaliseStatus('')).toBe(PAYMENT_STATUS.failed)
    // A browser-supplied "success" string still has to survive amount checks above.
    expect(normaliseStatus('success')).toBe(PAYMENT_STATUS.successful)
  })

  it('ignores a repeated settlement of an already-settled payment', async () => {
    const result = await verifyAndSettle(store(), null, {
      payment: { ...payment, status: PAYMENT_STATUS.successful },
      confirmation: { status: 'successful', amount: '250000', currency: 'UGX' },
    })
    expect(result.changed).toBe(false)
    expect(result.reason).toBe('already_settled')
  })

  it('settles with one conditional statement and retains an artwork status', async () => {
    let statement = ''
    const database = {
      query: async (sql) => {
        statement = sql
        return [{ ...payment, status: PAYMENT_STATUS.successful }]
      },
    }
    const result = await verifyAndSettle(database, null, {
      payment,
      confirmation: { status: 'successful', amount: '250000', currency: 'UGX' },
    })
    expect(result.changed).toBe(true)
    expect(statement).toContain('WITH settled AS')
    expect(statement).toContain("o.status_code='awaiting_payment'")
    expect(statement).toContain('order status retained')
  })

  it('makes a concurrent stale settlement inert without writing history', async () => {
    const statements = []
    const database = {
      query: async (sql) => {
        statements.push(sql)
        if (sql.includes('WITH settled AS')) return []
        return [{ ...payment, status: PAYMENT_STATUS.successful }]
      },
    }
    const result = await verifyAndSettle(database, null, {
      payment,
      confirmation: { status: 'successful', amount: '250000', currency: 'UGX' },
    })
    expect(result.changed).toBe(false)
    expect(result.reason).toBe('already_settled')
    expect(statements).toHaveLength(2)
  })

  it('makes duplicate webhook deliveries inert', async () => {
    let inserted = 0
    const events = new Set()
    const eventStore = {
      query: async (statement, params) => {
        if (statement.startsWith('INSERT INTO public.payment_events')) {
          const key = `${params[0]}:${params[1]}`
          if (events.has(key)) throw new Error('duplicate key value violates unique constraint')
          events.add(key); inserted += 1; return []
        }
        return []
      },
    }
    expect(await recordWebhookEvent(eventStore, { provider: 'test', eventId: 'evt-1', payload: {} })).toBe(true)
    expect(await recordWebhookEvent(eventStore, { provider: 'test', eventId: 'evt-1', payload: {} })).toBe(false)
    expect(inserted).toBe(1)
  })

  it('refuses a webhook with no event id rather than processing it', async () => {
    await expect(recordWebhookEvent({ query: async () => [] }, { provider: 'test', eventId: null, payload: {} })).rejects.toThrow(ApiError)
  })

  it('asks the provider to retry when webhook persistence fails', async () => {
    const unavailable = { query: async () => { const error = new Error('connection dropped'); error.code = '08006'; throw error } }
    await expect(recordWebhookEvent(unavailable, { provider: 'test', eventId: 'evt-2', payload: {} }))
      .rejects.toMatchObject({ status: 503, code: 'webhook_not_recorded' })
  })

  it('redacts secrets and card data before storing a payload', () => {
    const scrubbed = scrub({
      amount: '250000',
      signature: 'abc123',
      customer: { card_number: '4111111111111111', authorization: 'Bearer x', name: 'Ada' },
      nested: [{ webhook_secret: 's3cret' }],
    })
    expect(scrubbed.amount).toBe('250000')
    expect(scrubbed.signature).toBe('[redacted]')
    expect(scrubbed.customer.card_number).toBe('[redacted]')
    expect(scrubbed.customer.authorization).toBe('[redacted]')
    expect(scrubbed.customer.name).toBe('Ada')
    expect(scrubbed.nested[0].webhook_secret).toBe('[redacted]')
    expect(JSON.stringify(scrubbed)).not.toContain('4111111111111111')
  })
})

describe('references', () => {
  it('exposes no database id, timestamp or sequence', () => {
    const references = Array.from({ length: 200 }, () => makeReference('order'))
    for (const reference of references) {
      expect(reference).toMatch(/^MOT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/)
      // Ambiguous glyphs would cause transcription errors over the phone.
      expect(reference.slice(4)).not.toMatch(/[IO01]/)
    }
    // Not sequential, and not derived from the clock.
    expect(new Set(references).size).toBeGreaterThan(195)
    expect(references.some(r => r.includes(String(Date.now()).slice(0, 5)))).toBe(false)
  })

  it('uses a distinct prefix per record type', () => {
    expect(makeReference('quote_request')).toMatch(/^MOT-Q-/)
    expect(makeReference('quote')).toMatch(/^MOT-QT-/)
    expect(makeReference('order')).toMatch(/^MOT-/)
  })
})
