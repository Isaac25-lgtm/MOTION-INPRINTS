import { describe, expect, it } from 'vitest'
import { createApi } from '../server/api.js'
import { createTrackingToken, hashTrackingToken } from '../server/workflow.js'
import { hashToken } from '../server/quotes.js'
import { ownerActor } from './helpers/env.js'

const silent = { info() {}, error() {} }
const req = (path, options) => new Request(`https://api.motion.test${path}`, options)
const post = (path, body, headers = {}) => req(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
})
const read = async (response) => ({ status: response.status, ...(await response.json().catch(() => ({}))) })

describe('removed customer account routes', () => {
  const api = createApi({ db: { query: async () => [] }, logger: silent })

  it('does not expose profile, staff bootstrap, or customer quote lists', async () => {
    expect((await api(req('/api/me'))).status).toBe(404)
    expect((await api(req('/api/staff/bootstrap', { method: 'POST' }))).status).toBe(404)
    expect((await api(req('/api/quotes'))).status).toBe(404)
    expect((await api(req('/api/orders'))).status).toBe(404)
  })
})

describe('guest quote and order tokens', () => {
  const quoteId = '6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d'
  const token = 'quote-access-token'
  const quote = {
    id: quoteId,
    quote_number: 'QT-1',
    status_code: 'sent',
    currency: 'UGX',
    subtotal: '100000',
    tax_amount: '0',
    total_amount: '100000',
    valid_until: new Date(Date.now() + 86_400_000).toISOString(),
    sent_at: new Date().toISOString(),
    access_token: hashToken(token),
    access_token_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    access_token_revoked_at: null,
    superseded_at: null,
    customer_accepted_at: null,
  }

  it('opens a quote only with the access token', async () => {
    const db = {
      query: async (statement) => {
        if (statement.includes('FROM public.quotes q')) return [quote]
        return []
      },
    }
    const api = createApi({ db, logger: silent })
    const missing = await read(await api(req(`/api/quotes/${quoteId}/public`)))
    const wrong = await read(await api(req(`/api/quotes/${quoteId}/public?token=nope`)))
    const ok = await read(await api(req(`/api/quotes/${quoteId}/public?token=${token}`)))
    expect(missing.status).toBe(404)
    expect(wrong.status).toBe(404)
    expect(missing.error.message).toBe(wrong.error.message)
    expect(ok.status).toBe(200)
    expect(JSON.stringify(ok.data)).not.toContain(quote.access_token)
  })

  it('accepts a quote response from the token in the body, not a customer profile', async () => {
    const db = {
      query: async (statement) => {
        if (statement.includes('FROM public.quotes q')) return [quote]
        if (statement.includes('UPDATE public.quotes')) return [{ ...quote, status_code: 'accepted', customer_accepted_at: new Date().toISOString() }]
        return []
      },
    }
    const api = createApi({ db, authenticate: async () => null, logger: silent })
    const result = await read(await api(post(`/api/quotes/${quoteId}/respond`, { action: 'decline', token })))
    expect(result.status).not.toBe(401)
    expect(result.status).not.toBe(403)
    expect([200, 409]).toContain(result.status)
  })

  it('authorises order detail, proofs, proof response and reorder only with reference plus token', async () => {
    const tracking = createTrackingToken()
    const order = {
      id: 'o1',
      order_number: 'MOT-AAA222',
      status_code: 'awaiting_customer_approval',
      subtotal: '100000',
      tax_amount: '0',
      delivery_amount: '0',
      total_amount: '100000',
      currency: 'UGX',
      fulfilment_method: 'collection',
      contact_name: 'Amina',
      contact_email: 'amina@example.test',
      contact_phone: '+256700000000',
      created_at: new Date().toISOString(),
      tracking_token: hashTrackingToken(tracking),
    }
    const proof = {
      id: '6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d',
      order_id: 'o1',
      version: 1,
      status: 'awaiting_response',
      motion_notes: 'Please check the logo',
      created_at: new Date().toISOString(),
    }
    const db = {
      query: async (statement) => {
        if (statement.includes('FROM public.orders o WHERE o.order_number')) return [order]
        if (statement.includes('FROM public.design_proofs p WHERE p.id')) return [proof]
        if (statement.includes('FROM public.design_proofs')) return [proof]
        if (statement.includes('FROM public.order_items oi')) return []
        return []
      },
      transaction: async (build) => build({ query: async () => [proof] }),
    }
    const api = createApi({ db, logger: silent })
    const notFound = 'Order not found.'
    const bare = await read(await api(req('/api/track/MOT-AAA222')))
    const wrong = await read(await api(req('/api/track/MOT-AAA222?token=wrong')))
    expect(bare.status).toBe(404)
    expect(wrong.status).toBe(404)
    expect(bare.error.message).toBe(notFound)
    expect(wrong.error.message).toBe(notFound)

    const tracked = await read(await api(req(`/api/track/MOT-AAA222?token=${encodeURIComponent(tracking)}`)))
    expect(tracked.status).toBe(200)
    expect(tracked.data.reference).toBe('MOT-AAA222')
    expect(JSON.stringify(tracked.data)).not.toContain(order.tracking_token)
    expect(JSON.stringify(tracked.data)).not.toContain('internal_notes')

    const proofs = await read(await api(req(`/api/track/MOT-AAA222/proofs?token=${encodeURIComponent(tracking)}`)))
    expect(proofs.status).toBe(200)

    const reorder = await read(await api(req(`/api/track/MOT-AAA222/reorder?token=${encodeURIComponent(tracking)}`)))
    expect(reorder.status).not.toBe(401)
    expect(reorder.status).not.toBe(403)

    const proofOk = await read(await api(post(`/api/proofs/${proof.id}/respond`, {
      action: 'approve',
      token: tracking,
      reference: 'MOT-AAA222',
    })))
    expect(proofOk.status).not.toBe(401)
    expect([200, 409]).toContain(proofOk.status)

    const proofBare = await read(await api(post(`/api/proofs/${proof.id}/respond`, {
      action: 'approve',
      token: 'wrong',
      reference: 'MOT-AAA222',
    })))
    expect(proofBare.status).toBe(404)
    expect(proofBare.error.message).toBe(notFound)
  })
})

describe('uploads stay honest while storage is unconfigured', () => {
  it('returns storage_not_configured instead of pretending a transfer succeeded', async () => {
    const api = createApi({
      db: { query: async () => [] },
      authenticate: async () => ownerActor,
      logger: silent,
    })
    const result = await read(await api(post('/api/files/upload-intent', {
      filename: 'a.pdf', mimeType: 'application/pdf', byteSize: 100, purpose: 'customer_artwork',
    })))
    expect(result.status).toBe(501)
    expect(result.error.code).toBe('storage_not_configured')
  })

  it('never lets a guest complete an artwork upload', async () => {
    const storage = { configured: true, createUploadUrl: async () => ({ url: 'signed', method: 'PUT' }) }
    const api = createApi({
      db: { query: async () => [], transaction: async (build) => Promise.all(build({ query: async () => [] })) },
      storage,
      authenticate: async () => null,
      logger: silent,
    })
    const result = await read(await api(post('/api/files/upload-intent', {
      filename: 'a.pdf', mimeType: 'application/pdf', byteSize: 100, purpose: 'customer_artwork',
      orderItemId: '6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d',
    })))
    expect(result.status).toBe(401)
    expect(result.status).not.toBe(201)
  })
})
