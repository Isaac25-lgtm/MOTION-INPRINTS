import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createApi } from '../server/api.js'
import { ApiError, parsePaging } from '../server/http.js'
import { requireOwnership } from '../server/auth.js'
import { validateUpload } from '../server/storage.js'
import { productSchema, quoteRequestSchema, validate } from '../server/validation.js'
import { createClientKeyResolver, createMemoryRateLimiter } from '../server/handler.js'
import { createDatabaseClient } from '../server/db.js'
import { serverConfig } from '../server/config.js'

const silentLogger = { info() {}, error() {} }
const request = (path, options) => new Request(`https://api.motion.test${path}`, options)
const responseBody = async (response) => ({ status: response.status, ...(await response.json()) })

describe('backend access and input rules', () => {
  it('returns only published products to public visitors', async () => {
    const db = { query: async (statement) => { expect(statement).toContain("status='published'"); return [{ slug: 'banner', name: 'Banner' }] } }
    const api = createApi({ db, logger: silentLogger })
    const result = await responseBody(await api(request('/api/products')))
    // `image` resolves to null until object storage is provisioned; it is never a fabricated URL.
    expect(result.status).toBe(200); expect(result.data).toEqual([{ slug: 'banner', name: 'Banner', image: null }])
  })

  it('filters and sorts public listings only through a fixed whitelist', async () => {
    const seen = []
    const db = { query: async (statement, values) => { seen.push({ statement, values }); return [] } }
    const api = createApi({ db, logger: silentLogger })
    await api(request('/api/products?category=signage&sort=price-asc'))
    expect(seen[0].statement).toContain('ORDER BY p.starting_price ASC')
    expect(seen[0].values).toEqual(['signage', 20, 0])
    // An unknown sort falls back to the default rather than reaching the SQL string.
    seen.length = 0
    await api(request("/api/products?sort=name); DROP TABLE products;--"))
    expect(seen[0].statement).toContain('ORDER BY p.published_at DESC')
    expect(seen[0].statement).not.toContain('DROP TABLE')
  })

  it('supports catalogue search and Featured ordering without exposing SQL input', async () => {
    const seen = []
    const db = { query: async (statement, values) => { seen.push({ statement, values }); return [] } }
    const api = createApi({ db, logger: silentLogger })
    await api(request('/api/products?sort=featured&q=100%25_cards'))
    expect(seen[0].statement).toContain('ORDER BY p.is_featured DESC')
    expect(seen[0].statement).toContain("ILIKE $1 ESCAPE")
    expect(seen[0].values[0]).toBe('%100\\%\\_cards%')
  })

  it('escapes wildcards in search terms and ignores very short queries', async () => {
    const seen = []
    const db = { query: async (statement, values) => { seen.push({ statement, values }); return [] } }
    const api = createApi({ db, logger: silentLogger })
    const short = await responseBody(await api(request('/api/search?q=a')))
    expect(short.data).toEqual({ term: 'a', products: [], services: [], projects: [] })
    expect(seen).toHaveLength(0)
    await api(request('/api/search?q=100%25'))
    expect(seen[0].values[0]).toBe('%100\\%%')
  })

  it('uses the current Neon parameterized query API and transaction query API', async () => {
    const calls = []
    const fakeSql = () => { throw new Error('Tagged templates are not used for parameterized statements.') }
    fakeSql.query = async (statement, parameters) => { calls.push({ statement, parameters }); return [{ ok: true }] }
    fakeSql.transaction = async (build) => build({ query: (statement, parameters) => ({ statement, parameters }) })
    const db = createDatabaseClient(fakeSql)
    await expect(db.query('SELECT $1', ['value'])).resolves.toEqual([{ ok: true }])
    await expect(db.transaction((transaction) => [transaction.query('UPDATE example SET value=$1', ['value'])])).resolves.toEqual([{ statement: 'UPDATE example SET value=$1', parameters: ['value'] }])
    expect(calls).toEqual([{ statement: 'SELECT $1', parameters: ['value'] }])
  })

  it('rejects customer access to another customer resource', () => {
    expect(() => requireOwnership({ customer_id: 'customer-b' }, { profile: { id: 'customer-a' } })).toThrow(ApiError)
  })

  it('rejects unauthenticated admin access', async () => {
    const api = createApi({ db: { query: async () => [] }, logger: silentLogger })
    const result = await responseBody(await api(request('/api/admin/products', { method: 'POST', body: '{}' })))
    expect(result.status).toBe(401); expect(result.error.code).toBe('authentication_required')
  })

  it('accepts a valid quote request and never invents a price', async () => {
    const seen = []
    const api = createApi({ db: { query: async (statement, values) => {
      seen.push({ statement, values })
      // The reference generator probes for a collision first; an empty result
      // means the candidate reference is free.
      if (statement.startsWith('SELECT 1 FROM')) return []
      return [{ id: 'q', request_number: 'MOT-Q-K7P2QX', status_code: 'submitted' }]
    } }, logger: silentLogger })
    const result = await responseBody(await api(request('/api/quote-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contactName: 'Ada Client', contactEmail: 'ada@example.com', projectBrief: 'A clear request for branded signage.' }) })))
    expect(result.status).toBe(201)
    const insert = seen.find(call => call.statement.includes('INSERT INTO public.quote_requests'))
    expect(insert).toBeDefined()
    expect(JSON.stringify(insert.values)).not.toContain('price')
    // The reference is random, not sequential, and carries no timestamp.
    expect(result.data.request_number).toMatch(/^MOT-Q-/)
  })

  it('rejects invalid prices and quantities', () => {
    expect(() => validate(productSchema, { name: 'Cards', slug: 'cards', pricingType: 'fixed', startingPrice: -1, quoteRequired: false })).toThrow(ApiError)
    expect(() => validate(quoteRequestSchema, { contactName: 'A', contactEmail: 'not-email', projectBrief: 'short' })).toThrow(ApiError)
  })

  it('rejects unsafe uploads', () => {
    expect(() => validateUpload({ mimeType: 'application/x-msdownload', byteSize: 20, filename: 'file.exe' })).toThrow(ApiError)
    expect(() => validateUpload({ mimeType: 'image/png', byteSize: 20, filename: '../escape.png' })).toThrow(ApiError)
  })

  it('bounds and validates pagination rather than passing NaN to Postgres', () => {
    expect(parsePaging(new URL('https://motion.test/api/products?limit=abc&offset=-4'))).toEqual({ limit: 20, offset: 0 })
    expect(parsePaging(new URL('https://motion.test/api/products?limit=9000&offset=2'))).toEqual({ limit: 100, offset: 2 })
    // An absent parameter must use the default page size. Number(null) is 0, which
    // would otherwise pass the range check and clamp every listing to a single row.
    expect(parsePaging(new URL('https://motion.test/api/products'))).toEqual({ limit: 20, offset: 0 })
    expect(parsePaging(new URL('https://motion.test/api/products?limit='))).toEqual({ limit: 20, offset: 0 })
  })

  it('expires and bounds the in-memory rate-limit buckets', () => {
    const take = createMemoryRateLimiter({ windowMs: 60_000, max: 2, maxKeys: 2 })
    expect(take('one')).toBe(true); expect(take('two')).toBe(true); expect(take('three')).toBe(false)
  })

  it('requires admin role, not merely authentication, for product changes', async () => {
    const api = createApi({ db: { query: async () => [] }, authenticate: async () => ({ authUserId: 'auth-id', profile: { id: 'customer-id', role: 'customer' } }), logger: silentLogger })
    const result = await responseBody(await api(request('/api/admin/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Cards', slug: 'cards', pricingType: 'quote_only', quoteRequired: true }) })))
    expect(result.status).toBe(403); expect(result.error.code).toBe('owner_required')
  })

  it('separates rate-limit buckets per client instead of pooling every visitor', () => {
    const resolve = createClientKeyResolver({ trustedClientHeader: 'x-real-ip' })
    expect(resolve(request('/api/products', { headers: { 'x-real-ip': '203.0.113.5' } }))).toBe('client:203.0.113.5')
    const first = resolve(request('/api/orders', { headers: { authorization: 'Bearer token-a' } }))
    const second = resolve(request('/api/orders', { headers: { authorization: 'Bearer token-b' } }))
    expect(first).not.toBe(second)
    expect(first).not.toContain('token-a')
    // Unidentifiable callers are not forced into one shared bucket, which would limit the whole site as a single client.
    expect(resolve(request('/api/products'))).toBeNull()
  })

  it('refuses to start in production without a trusted client header', () => {
    /* The auth values must now be real URLs: serverConfig validates that the
       issuer is an origin and the JWKS is its well-known path, because pasting
       one into both is the failure that presents as a broken login rather than
       as a misconfiguration. Placeholders no longer get through. */
    const base = {
      DATABASE_URL: 'x',
      NEON_AUTH_JWKS_URL: 'https://ep-test.neonauth.example.aws.neon.tech/neondb/auth/.well-known/jwks.json',
      NEON_AUTH_ISSUER: 'https://ep-test.neonauth.example.aws.neon.tech',
    }
    expect(() => serverConfig({ ...base, NODE_ENV: 'production' })).toThrow(/API_TRUSTED_CLIENT_HEADER/)
    expect(serverConfig({ ...base, NODE_ENV: 'production', API_TRUSTED_CLIENT_HEADER: 'X-Real-IP' }).trustedClientHeader).toBe('x-real-ip')

    /* Render appends to X-Forwarded-For rather than replacing it, so no header
       there can be trusted. `none` is how a deployment states that on the
       record: it satisfies the guard — which exists to catch a variable someone
       forgot, not a decision someone made — and resolves to no trusted header,
       so the resolver falls through to session identity. */
    const acknowledged = serverConfig({ ...base, NODE_ENV: 'production', API_TRUSTED_CLIENT_HEADER: 'none' })
    expect(acknowledged.trustedClientHeader).toBeNull()
  })

  /* Naming a header the platform merely appends to is worse than naming none:
     it hands every caller a bucket of their own choosing while the code reads as
     though limiting is in force. This pins the ordering that makes a spoofable
     header unable to affect an authenticated caller. */
  it('never lets a client-supplied header override session identity', () => {
    const resolve = createClientKeyResolver({ trustedClientHeader: 'x-forwarded-for' })

    // A caller spoofing the header cannot escape or widen their session bucket.
    const spoofed = resolve(request('/api/orders', {
      headers: { authorization: 'Bearer token-a', 'x-forwarded-for': '9.9.9.9' },
    }))
    const rotated = resolve(request('/api/orders', {
      headers: { authorization: 'Bearer token-a', 'x-forwarded-for': '8.8.8.8' },
    }))
    expect(spoofed).toBe(rotated)
    expect(spoofed).toMatch(/^session:/)
    expect(spoofed).not.toContain('9.9.9.9')

    // The header still identifies callers who present no credential at all.
    expect(resolve(request('/api/products', { headers: { 'x-forwarded-for': '203.0.113.5' } })))
      .toBe('client:203.0.113.5')

    // With no trusted header configured, anonymous callers stay unidentifiable
    // rather than being pooled into one bucket that limits the whole site.
    const sessionOnly = createClientKeyResolver({ trustedClientHeader: null })
    expect(sessionOnly(request('/api/products', { headers: { 'x-forwarded-for': '203.0.113.5' } }))).toBeNull()
    expect(sessionOnly(request('/api/orders', { headers: { authorization: 'Bearer t' } }))).toMatch(/^session:/)
  })

  it('applies a partial admin PATCH without demanding every field', async () => {
    const seen = []
    const db = { query: async (statement, values) => { seen.push({ statement, values }); return [{ id: 'product-id', slug: 'cards', status: 'published' }] } }
    const api = createApi({ db, authenticate: async () => ({ authUserId: 'a', profile: { id: 'p', role: 'owner' } }), logger: silentLogger })
    const result = await responseBody(await api(request('/api/admin/products/6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'published' }) })))
    expect(result.status).toBe(200)
    expect(seen[0].statement).toContain('SET status=$1')
    expect(seen[0].statement).not.toContain('name=')
    expect(seen[0].values).toEqual(['published', '6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d'])
  })

  it('rejects an admin PATCH that carries no fields', async () => {
    const api = createApi({ db: { query: async () => [] }, authenticate: async () => ({ authUserId: 'a', profile: { id: 'p', role: 'owner' } }), logger: silentLogger })
    const result = await responseBody(await api(request('/api/admin/products/6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' })))
    expect(result.status).toBe(422); expect(result.error.code).toBe('empty_update')
  })

  it('stops a customer from placing objects in public website buckets', async () => {
    const storage = { createUploadUrl: async () => ({ url: 'signed', method: 'PUT' }) }
    const db = {
      query: async () => [{ id: 'owned-order-item', object_key: 'k' }],
      transaction: async (build) => Promise.all(build({ query: async () => [] })),
    }
    const customer = createApi({ db, storage, authenticate: async () => ({ authUserId: 'c', profile: { id: 'pc', role: 'customer' } }), logger: silentLogger })
    const body = JSON.stringify({ filename: 'x.png', mimeType: 'image/png', byteSize: 100, purpose: 'product_image' })
    const blocked = await responseBody(await customer(request('/api/files/upload-intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body })))
    expect(blocked.status).toBe(403); expect(blocked.error.code).toBe('owner_required')
    const fakeProof = await responseBody(await customer(request('/api/files/upload-intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: 'proof.pdf', mimeType: 'application/pdf', byteSize: 100, purpose: 'design_proof' }) })))
    expect(fakeProof.status).toBe(403)
    const admin = createApi({ db, storage, authenticate: async () => ({ authUserId: 'a', profile: { id: 'pa', role: 'owner' } }), logger: silentLogger })
    const allowed = await responseBody(await admin(request('/api/files/upload-intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body })))
    expect(allowed.status).toBe(201)
    // Customers keep their own private artwork route.
    const artwork = await responseBody(await customer(request('/api/files/upload-intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: 'a.pdf', mimeType: 'application/pdf', byteSize: 100, purpose: 'customer_artwork', orderItemId: '6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d' }) })))
    expect(artwork.status).toBe(201)
  })

  it('does not create an artwork row when signed storage is unavailable', async () => {
    const seen = []
    const db = {
      query: async (statement) => { seen.push(statement); return [{ id: 'owned' }] },
      transaction: async () => { throw new Error('transaction must not start') },
    }
    const storage = { createUploadUrl: async () => { throw new ApiError(501, 'storage_not_configured', 'Storage unavailable.') } }
    const api = createApi({ db, storage, authenticate: async () => ({ authUserId: 'c', profile: { id: 'pc', role: 'customer' } }), logger: silentLogger })
    const response = await responseBody(await api(request('/api/files/upload-intent', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'a.pdf', mimeType: 'application/pdf', byteSize: 100, purpose: 'customer_artwork', orderItemId: '6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d' }),
    })))
    expect(response.status).toBe(501)
    expect(seen.some(statement => statement.includes('INSERT INTO public.media_assets'))).toBe(false)
  })

  it('updates one content entry rather than every key in the section', async () => {
    const seen = []
    const db = { query: async (statement, values) => { seen.push({ statement, values }); return [{ id: 'c', section: 'contact', entry_key: 'details' }] } }
    const api = createApi({ db, authenticate: async () => ({ authUserId: 'a', profile: { id: 'p', role: 'owner' } }), logger: silentLogger })
    const result = await responseBody(await api(request('/api/admin/content/contact', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entryKey: 'details', value: { phone: '' } }) })))
    expect(result.status).toBe(200)
    expect(seen[0].statement).toContain('WHERE section = $8 AND entry_key = $9')
    // status is the single source of truth; is_published is kept in step with it,
    // so an administrator cannot publish content that stays invisible.
    expect(seen[0].statement).toContain("is_published = (COALESCE($2, status) = 'published')")
    // $6 section, $7 entry_key — scoped to one entry, not the whole section.
    expect(seen[0].values[7]).toBe('contact')
    expect(seen[0].values[8]).toBe('details')
  })

  it('clears a stale schedule when content is published immediately', async () => {
    const seen = []
    const db = { query: async (statement, values) => { seen.push({ statement, values }); return [{ id: 'c' }] } }
    const api = createApi({ db, authenticate: async () => ({ authUserId: 'a', profile: { id: 'p', role: 'owner' } }), logger: silentLogger })
    const result = await responseBody(await api(request('/api/admin/content/announcement', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'published' }),
    })))
    expect(result.status).toBe(200)
    expect(seen[0].values[2]).toBe(true)
    expect(seen[0].values[3]).toBeNull()
    expect(seen[0].values[4]).toBe(true)
    expect(seen[0].values[5]).toBeNull()
  })

  it('routes quote sending through the dedicated prepared-to-sent transition', async () => {
    const seen = []
    const db = { query: async (statement, values) => {
      seen.push({ statement, values })
      return [{ id: '6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d', status_code: 'sent', currency: 'UGX' }]
    } }
    const api = createApi({ db, authenticate: async () => ({ authUserId: 'a', profile: { id: 'p', role: 'owner' } }), logger: silentLogger })
    const result = await responseBody(await api(request('/api/admin/quotes/6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d/send', { method: 'POST' })))
    expect(result.status).toBe(200)
    expect(result.data.accessToken).toBeTruthy()
    expect(seen[0].statement).toContain("status_code='prepared'")
    expect(seen[0].values[1]).toMatch(/^[0-9a-f]{64}$/)
    expect(seen[0].values[1]).not.toBe(result.data.accessToken)
  })

  it('does not expose the legacy quote PATCH bypass', async () => {
    const api = createApi({ db: { query: async () => [] }, authenticate: async () => ({ authUserId: 'a', profile: { id: 'p', role: 'owner' } }), logger: silentLogger })
    const result = await responseBody(await api(request('/api/admin/quotes/6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ statusCode: 'sent' }),
    })))
    expect(result.status).toBe(404)
  })

  it('defines cascading order items and quote-to-order integrity in the migration', async () => {
    const sql = await readFile(new URL('../db/migrations/0001_motion_core.sql', import.meta.url), 'utf8')
    expect(sql).toMatch(/order_id uuid NOT NULL REFERENCES public\.orders\(id\) ON DELETE CASCADE/)
    expect(sql).toContain('FOREIGN KEY (quote_id) REFERENCES public.quotes(id)')
  })
})
