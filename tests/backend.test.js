import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createApi } from '../server/api.js'
import { ApiError, parsePaging } from '../server/http.js'
import { requireOwnership } from '../server/auth.js'
import { validateUpload } from '../server/storage.js'
import { productSchema, quoteRequestSchema, validate } from '../server/validation.js'
import { createMemoryRateLimiter } from '../server/handler.js'
import { createDatabaseClient } from '../server/db.js'

const silentLogger = { info() {}, error() {} }
const request = (path, options) => new Request(`https://api.motion.test${path}`, options)
const responseBody = async (response) => ({ status: response.status, ...(await response.json()) })

describe('backend access and input rules', () => {
  it('returns only published products to public visitors', async () => {
    const db = { query: async (statement) => { expect(statement).toContain("status='published'"); return [{ slug: 'banner', name: 'Banner' }] } }
    const api = createApi({ db, logger: silentLogger })
    const result = await responseBody(await api(request('/api/products')))
    expect(result.status).toBe(200); expect(result.data).toEqual([{ slug: 'banner', name: 'Banner' }])
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
    const api = createApi({ db: { query: async (statement, values) => { seen.push({ statement, values }); return [{ id: 'q', request_number: 'QR-1', status_code: 'submitted' }] } }, logger: silentLogger })
    const result = await responseBody(await api(request('/api/quote-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contactName: 'Ada Client', contactEmail: 'ada@example.com', projectBrief: 'A clear request for branded signage.' }) })))
    expect(result.status).toBe(201); expect(seen[0].statement).toContain('INSERT INTO public.quote_requests'); expect(JSON.stringify(seen[0].values)).not.toContain('price')
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
  })

  it('expires and bounds the in-memory rate-limit buckets', () => {
    const take = createMemoryRateLimiter({ windowMs: 60_000, max: 2, maxKeys: 2 })
    expect(take('one')).toBe(true); expect(take('two')).toBe(true); expect(take('three')).toBe(false)
  })

  it('requires admin role, not merely authentication, for product changes', async () => {
    const api = createApi({ db: { query: async () => [] }, authenticate: async () => ({ authUserId: 'auth-id', profile: { id: 'customer-id', role: 'customer' } }), logger: silentLogger })
    const result = await responseBody(await api(request('/api/admin/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Cards', slug: 'cards', pricingType: 'quote_only', quoteRequired: true }) })))
    expect(result.status).toBe(403); expect(result.error.code).toBe('admin_required')
  })

  it('defines cascading order items and quote-to-order integrity in the migration', async () => {
    const sql = await readFile(new URL('../db/migrations/0001_motion_core.sql', import.meta.url), 'utf8')
    expect(sql).toMatch(/order_id uuid NOT NULL REFERENCES public\.orders\(id\) ON DELETE CASCADE/)
    expect(sql).toContain('FOREIGN KEY (quote_id) REFERENCES public.quotes(id)')
  })
})
