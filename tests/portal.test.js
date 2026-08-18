import { describe, expect, it } from 'vitest'
import { ApiError } from '../server/http.js'
import {
  CUSTOMER_STATUS, assertTransition, buildTimeline,
  createTrackingToken, hashTrackingToken, respondToProof, trackingTokenMatches,
} from '../server/workflow.js'
import { evaluateReorder, priceComparison } from '../server/reorder.js'
import { resolveRange, METRIC_DEFINITIONS } from '../server/reports.js'
import { createApi } from '../server/api.js'

/* Prompts 9.5 and 10.7 — adversarial checks for the portal and admin surface. */

const silent = { info() {}, error() {} }
const get = (path, headers) => new Request(`https://api.motion.test${path}`, { headers })
const read = async (response) => ({ status: response.status, ...(await response.json()) })

describe('production workflow transitions', () => {
  it('permits the real production sequence', () => {
    expect(() => assertTransition('artwork_required', 'artwork_received')).not.toThrow()
    expect(() => assertTransition('design_in_progress', 'awaiting_customer_approval')).not.toThrow()
    expect(() => assertTransition('approved', 'in_production')).not.toThrow()
    expect(() => assertTransition('in_production', 'ready')).not.toThrow()
    expect(() => assertTransition('ready', 'dispatched')).not.toThrow()
  })

  it('refuses to skip the middle of the workflow', () => {
    // The attack this prevents: a crafted PATCH marking a job complete without
    // artwork, proof or production ever happening.
    expect(() => assertTransition('new', 'completed')).toThrow(/cannot move/i)
    expect(() => assertTransition('artwork_required', 'ready')).toThrow(/cannot move/i)
    expect(() => assertTransition('new', 'dispatched')).toThrow(/cannot move/i)
  })

  it('refuses to reopen a finished or cancelled order', () => {
    expect(() => assertTransition('completed', 'in_production')).toThrow(ApiError)
    expect(() => assertTransition('cancelled', 'new')).toThrow(ApiError)
  })

  it('rejects an unknown status rather than storing it', () => {
    expect(() => assertTransition('not_a_status', 'ready')).toThrow(/not recognised/i)
    expect(() => assertTransition('new', 'new')).toThrow(/already in that state/i)
  })
})

describe('customer-facing status and timeline', () => {
  it('translates every internal status into customer wording', () => {
    for (const code of ['new', 'awaiting_payment', 'artwork_required', 'artwork_received',
      'design_in_progress', 'awaiting_customer_approval', 'approved', 'in_production',
      'ready', 'dispatched', 'completed', 'cancelled']) {
      expect(CUSTOMER_STATUS[code], `${code} has no customer wording`).toBeDefined()
      expect(CUSTOMER_STATUS[code].label).not.toMatch(/_/)
    }
    expect(CUSTOMER_STATUS.artwork_required.label).toBe('Artwork needed')
    expect(CUSTOMER_STATUS.awaiting_customer_approval.label).toBe('Waiting for your approval')
  })

  it('never invents a timestamp for a stage that has not happened', () => {
    const history = [
      { status_code: 'new', created_at: '2026-01-01T09:00:00Z' },
      { status_code: 'artwork_required', created_at: '2026-01-02T09:00:00Z' },
    ]
    const stages = buildTimeline('artwork_required', history)
    const done = stages.filter(stage => stage.state === 'done')
    const upcoming = stages.filter(stage => stage.state === 'upcoming')
    expect(done.every(stage => stage.at)).toBe(true)
    // A future stage carries no date — a customer would plan around one.
    expect(upcoming.every(stage => stage.at === null)).toBe(true)
  })

  it('shows a cancelled order as cancelled rather than mid-production', () => {
    const stages = buildTimeline('cancelled', [{ status_code: 'cancelled', created_at: '2026-01-03T09:00:00Z' }])
    expect(stages).toHaveLength(1)
    expect(stages[0].code).toBe('cancelled')
  })
})

describe('guest tracking security', () => {
  it('stores the tracking token hashed and compares it in constant time', () => {
    const token = createTrackingToken()
    const stored = hashTrackingToken(token)
    expect(stored).not.toBe(token)
    expect(stored).toMatch(/^[0-9a-f]{64}$/)
    expect(trackingTokenMatches(token, stored)).toBe(true)
    expect(trackingTokenMatches('guess', stored)).toBe(false)
    expect(trackingTokenMatches(null, stored)).toBe(false)
  })

  it('refuses tracking when no token is supplied, however valid the reference', async () => {
    const db = { query: async () => [{ id: 'o1', order_number: 'MOT-AAA222', tracking_token: hashTrackingToken('secret') }] }
    const api = createApi({ db, logger: silent })
    // An order number alone must never authorise. Same 404 as an unknown
    // reference, so references cannot be probed for existence.
    const bare = await read(await api(get('/api/track/MOT-AAA222')))
    expect(bare.status).toBe(404)
    const wrong = await read(await api(get('/api/track/MOT-AAA222?token=wrong')))
    expect(wrong.status).toBe(404)
    expect(wrong.error.message).toBe('Order not found.')
  })

  it('returns tracking-safe information only, never the customer record', async () => {
    /* A tracking link gets forwarded, printed on a job bag and read over
       shoulders. Whoever holds it must learn where the job is and nothing else. */
    const token = createTrackingToken()
    const order = {
      id: 'o1', order_number: 'MOT-BBB333', status_code: 'in_production',
      subtotal: '500000', tax_amount: '0', delivery_amount: '0', total_amount: '500000',
      currency: 'UGX', fulfilment_method: 'delivery',
      delivery_address: 'Plot 42, Kololo, Kampala',
      contact_name: 'Ada Lovelace', contact_email: 'ada@example.test', contact_phone: '+256700000000',
      company_name: 'Analytical Engines Ltd', notes: 'Call before delivering',
      created_at: '2026-01-01T00:00:00Z', tracking_token: hashTrackingToken(token),
    }
    const db = {
      query: async (statement) => {
        if (statement.includes('FROM public.orders o WHERE o.order_number')) return [order]
        if (statement.includes('FROM public.order_items')) return [{ id: 'i1', title: 'Pull-up banner', quantity: 2, unit_price: '250000', line_total: '500000', configuration: { size: '2m' }, artwork_status: 'received', design_service_required: false }]
        return []
      },
    }
    const api = createApi({ db, logger: silent })
    const result = await read(await api(get(`/api/track/MOT-BBB333?token=${encodeURIComponent(token)}`)))
    expect(result.status).toBe(200)

    const body = JSON.stringify(result.data)
    for (const leaked of ['Plot 42', 'Kololo', 'Ada Lovelace', 'ada@example.test', '+256700000000', 'Analytical Engines', 'Call before delivering', '500000']) {
      expect(body, `tracking response leaked "${leaked}"`).not.toContain(leaked)
    }
    // What it must still carry: enough to know where the job has got to.
    expect(result.data.reference).toBe('MOT-BBB333')
    expect(result.data.statusLabel).toBe('In production')
    expect(result.data.timeline.length).toBeGreaterThan(0)
    expect(result.data.items[0]).toEqual({ title: 'Pull-up banner', quantity: 2 })
    // Item configuration and artwork state are not tracking information.
    expect(result.data.items[0].configuration).toBeUndefined()
    expect(result.data.total).toBeUndefined()
  })

  it('issues unguessable tokens', () => {
    const tokens = Array.from({ length: 200 }, () => createTrackingToken())
    expect(new Set(tokens).size).toBe(200)
    expect(tokens[0].length).toBeGreaterThanOrEqual(43)
  })
})

describe('proof approval', () => {
  const proof = { id: 'p1', order_id: 'o1', version: 2, status: 'awaiting_response', superseded_at: null, customer_response_at: null }
  const store = { query: async () => [], transaction: async (build) => build({ query: async () => [{ id: 'p1' }] }) }

  it('refuses approval of a superseded version', async () => {
    await expect(respondToProof(store, { proof: { ...proof, superseded_at: new Date().toISOString() }, action: 'approve' }))
      .rejects.toThrow(/newer version/i)
    await expect(respondToProof(store, { proof: { ...proof, status: 'superseded' }, action: 'approve' }))
      .rejects.toThrow(/newer version/i)
  })

  it('refuses a second response to the same version', async () => {
    await expect(respondToProof(store, { proof: { ...proof, customer_response_at: new Date().toISOString() }, action: 'approve' }))
      .rejects.toThrow(/already responded/i)
  })

  it('loses a concurrent approval race rather than double-recording', async () => {
    // The conditional UPDATE matches nothing because another request won.
    const contended = { query: async () => [], transaction: async (build) => build({ query: async () => [] }) }
    await expect(respondToProof(contended, { proof, action: 'approve' })).rejects.toThrow(/already been answered/i)
  })
})

describe('reorder', () => {
  const product = {
    id: 'p1', name: 'Banner', slug: 'banner', status: 'published', pricing_type: 'fixed',
    currency: 'UGX', starting_price: '120000', quote_required: false, min_quantity: 1, max_quantity: 500,
  }
  const withItems = (items, productRows = [product]) => ({
    query: async (statement) => {
      if (statement.includes('FROM public.order_items oi')) return items
      if (statement.includes('FROM public.products')) return productRows
      return []
    },
  })

  it('re-prices at today\'s rate rather than repeating the historical price', async () => {
    const result = await evaluateReorder(withItems([
      { id: 'i1', product_id: 'p1', title: 'Banner', quantity: 2, configuration: {}, product_status: 'published' },
    ]))
    // Ordered at 100,000 each historically; today's rule says 120,000.
    expect(result.items[0].currentPrice).toBe('240000')
    expect(result.items[0].eligible).toBe(true)
  })

  it('flags a discontinued product instead of silently substituting another', async () => {
    const result = await evaluateReorder(withItems([
      { id: 'i1', product_id: 'p1', title: 'Old banner', quantity: 1, configuration: {}, product_status: 'archived' },
    ]))
    expect(result.items[0].eligible).toBe(false)
    expect(result.items[0].reason).toBe('discontinued')
    expect(result.reorderable).toBe(false)
  })

  it('routes a quoted project to a fresh quote rather than a repeat charge', async () => {
    const result = await evaluateReorder(withItems([
      { id: 'i1', product_id: null, title: 'Office signage installation', quantity: 1, configuration: {} },
    ]))
    expect(result.items[0].reason).toBe('custom_project')
    expect(result.requiresQuote).toBe(true)
  })

  it('names the option that is no longer valid rather than guessing a replacement', async () => {
    const strict = {
      query: async (statement) => {
        if (statement.includes('FROM public.order_items oi')) {
          return [{ id: 'i1', product_id: 'p1', title: 'Banner', quantity: 1, configuration: { finish: 'discontinued-finish' }, product_status: 'published' }]
        }
        if (statement.includes('FROM public.products')) return [product]
        if (statement.includes('product_option_assignments a\n              JOIN') || statement.includes('FROM public.product_option_assignments')) {
          return [{ id: 'o1', code: 'finish', name: 'Finish', input_type: 'select', is_required: true }]
        }
        if (statement.includes('FROM public.product_option_values')) return [{ id: 'v1', option_id: 'o1', value: 'matte', label: 'Matte', is_active: true }]
        return []
      },
    }
    const result = await evaluateReorder(strict)
    expect(result.items[0].eligible).toBe(false)
    expect(result.items[0].reason).toBe('configuration_changed')
    expect(result.items[0].message).toMatch(/finish/i)
  })

  it('states a price change plainly in both directions', () => {
    expect(priceComparison('100000', '120000')).toMatchObject({ changed: true, direction: 'increased' })
    expect(priceComparison('120000', '100000')).toMatchObject({ changed: true, direction: 'decreased' })
    expect(priceComparison('100000', '100000')).toMatchObject({ changed: false })
  })
})

describe('admin authorization', () => {
  const asCustomer = async () => ({ authUserId: 'u1', profile: { id: 'c1', role: 'customer' } })

  it('refuses every admin route to an authenticated customer', async () => {
    const api = createApi({ db: { query: async () => [] }, authenticate: asCustomer, logger: silent })
    for (const path of ['/api/admin/dashboard', '/api/admin/reports', '/api/admin/customers', '/api/admin/audit']) {
      const result = await read(await api(get(path)))
      expect(result.status, `${path} should be refused`).toBe(403)
      expect(result.error.code).toBe('owner_required')
    }
  })

  it('refuses admin routes to an anonymous caller', async () => {
    const api = createApi({ db: { query: async () => [] }, logger: silent })
    const result = await read(await api(get('/api/admin/dashboard')))
    expect(result.status).toBe(401)
  })
})

describe('reports', () => {
  it('documents how every headline metric is calculated', () => {
    for (const key of ['revenue', 'orderCount', 'averageOrderValue', 'outstanding', 'quoteConversion']) {
      expect(METRIC_DEFINITIONS[key], `${key} is undocumented`).toBeTruthy()
    }
    // The denominator is explicit, not "eligible quotes" left to interpretation.
    expect(METRIC_DEFINITIONS.quoteConversion).toMatch(/quotes sent/i)
    expect(METRIC_DEFINITIONS.revenue).toMatch(/successful/i)
  })

  it('resolves named ranges to explicit bounds', () => {
    for (const range of ['today', 'this_week', 'this_month', 'last_month']) {
      const resolved = resolveRange(range)
      expect(resolved.from instanceof Date).toBe(true)
      expect(resolved.to.getTime()).toBeGreaterThan(resolved.from.getTime())
    }
    expect(() => resolveRange('custom', 'not-a-date', 'also-not')).toThrow(RangeError)
  })
})
