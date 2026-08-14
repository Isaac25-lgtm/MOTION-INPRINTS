import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createApi } from '../server/api.js'

/* Portfolio privacy and CMS scheduling (Prompts 7.1, 7.2, 7.4). */

const silent = { info() {}, error() {} }
const get = (path) => new Request(`https://api.motion.test${path}`)
const read = async (response) => ({ status: response.status, ...(await response.json()) })

const project = {
  id: 'j1', title: 'Office signage', slug: 'office-signage',
  client_name: 'Acme Holdings', show_client_name: false,
  source_reference: 'https://x.com/motion/status/123',
  location: 'Kampala', completed_on: '2026-01-10', image_key: null,
}

describe('portfolio privacy', () => {
  it('withholds a client name that was not approved for publication', async () => {
    const db = { query: async (statement) => (statement.includes('FROM public.projects') ? [project] : []) }
    const api = createApi({ db, logger: silent })
    const result = await read(await api(get('/api/projects')))
    expect(result.data[0].client_name).toBeNull()
    expect(JSON.stringify(result.data)).not.toContain('Acme Holdings')
  })

  it('publishes a client name once it has been approved', async () => {
    const db = { query: async (statement) => (statement.includes('FROM public.projects') ? [{ ...project, show_client_name: true }] : []) }
    const api = createApi({ db, logger: silent })
    const result = await read(await api(get('/api/projects')))
    expect(result.data[0].client_name).toBe('Acme Holdings')
  })

  it('never exposes the internal source reference', async () => {
    const db = { query: async (statement) => (statement.includes('FROM public.projects') ? [{ ...project, show_client_name: true }] : []) }
    const api = createApi({ db, logger: silent })
    const result = await read(await api(get('/api/projects')))
    // Provenance is for cataloguing, not for the public site.
    expect(JSON.stringify(result.data)).not.toContain('x.com')
    expect(result.data[0].source_reference).toBeUndefined()
  })
})

describe('CMS scheduling', () => {
  it('filters by publication window in SQL rather than trusting the caller', async () => {
    let sql = ''
    const db = { query: async (statement) => { sql = statement; return [] } }
    const api = createApi({ db, logger: silent })
    await api(get('/api/content/public'))
    // A scheduled entry is invisible before its start and after its end, with no
    // background job needed to flip it.
    expect(sql).toContain("status = 'published'")
    expect(sql).toContain("status = 'scheduled'")
    expect(sql).toContain('publish_from <= now()')
    expect(sql).toContain('publish_until > now()')
  })
})

describe('migrations', () => {
  const migration = (name) => readFile(fileURLToPath(new URL(`../db/migrations/${name}`, import.meta.url)), 'utf8')

  it('freezes an accepted quote in the database, not only in application code', async () => {
    const sql = await migration('0004_quotes_and_orders.sql')
    expect(sql).toContain('freeze_accepted_quote')
    expect(sql).toMatch(/RAISE EXCEPTION 'Quote % has been accepted/)
    // Only one live quote may exist per request.
    expect(sql).toContain('quotes_one_active_per_request')
  })

  it('replaces the payment status vocabulary rather than leaving two', async () => {
    const sql = await migration('0004_quotes_and_orders.sql')
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS payments_status_check")
    for (const status of ['pending', 'processing', 'successful', 'failed', 'cancelled', 'expired', 'refunded']) {
      expect(sql).toContain(`'${status}'`)
    }
    // Existing rows are migrated, not stranded on a value the new check rejects.
    expect(sql).toContain("SET status = 'successful' WHERE status = 'paid'")
  })

  it('guarantees a delivery order carries an address', async () => {
    const sql = await migration('0004_quotes_and_orders.sql')
    expect(sql).toContain('orders_delivery_needs_address')
  })

  it('defaults client-name publication to private', async () => {
    const sql = await migration('0005_portfolio_and_cms.sql')
    expect(sql).toMatch(/show_client_name boolean NOT NULL DEFAULT false/)
  })

  it('audits content changes by trigger so a handler cannot skip it', async () => {
    const sql = await migration('0005_portfolio_and_cms.sql')
    expect(sql).toContain('record_content_revision')
    expect(sql).toContain('content_entries_audit')
  })

  it('keeps pricing components constrained to the four supported kinds', async () => {
    const sql = await migration('0003_pricing_components.sql')
    for (const kind of ['base', 'quantity_tier', 'surcharge_fixed', 'surcharge_per_unit']) {
      expect(sql).toContain(`'${kind}'`)
    }
    expect(sql).toContain('pricing_rules_quantity_range')
  })
})
