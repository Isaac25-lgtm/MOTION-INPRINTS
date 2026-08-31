import { describe, expect, it } from 'vitest'
import { upsertCustomerContact } from '../server/contacts.js'
import { createApi } from '../server/api.js'
import { ownerActor } from './helpers/env.js'

const silent = { info() {}, error() {} }
const post = (path, body) => new Request(`https://api.motion.test${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
const get = (path) => new Request(`https://api.motion.test${path}`)
const read = async (response) => ({ status: response.status, ...(await response.json().catch(() => ({}))) })

describe('guest contact upsert', () => {
  it('upserts by normalized email and returns the contact id', async () => {
    const seen = []
    const db = {
      query: async (statement, values) => {
        seen.push({ statement, values })
        return [{ id: 'contact-1' }]
      },
    }
    const id = await upsertCustomerContact(db, {
      name: 'Amina Nakato',
      email: ' Amina@Example.COM ',
      phone: '+256700000000',
      company: 'Studio',
    })
    expect(id).toBe('contact-1')
    expect(seen[0].statement).toContain('INSERT INTO public.customer_contacts')
    expect(seen[0].statement).toContain('ON CONFLICT (normalized_email)')
    expect(seen[0].values[2]).toBe('amina@example.com')
    expect(seen[0].values[1]).toBe('Amina@Example.COM')
  })

  it('does not create credentials or profiles', async () => {
    const seen = []
    const db = {
      query: async (statement, values) => {
        seen.push({ statement, values })
        if (statement.includes('RETURNING')) return [{ id: 'c1', request_number: 'QR-1' }]
        return []
      },
    }
    db.transaction = async (build) => Promise.all(build({ query: db.query }))
    const api = createApi({ db, logger: silent })
    await api(post('/api/quote-requests', {
      contactName: 'Amina Nakato',
      contactEmail: 'amina@example.com',
      projectBrief: 'Two pull-up banners for a launch.',
    }))
    expect(seen.some((entry) => entry.statement.includes('customer_contacts'))).toBe(true)
    expect(seen.some((entry) => /user_profiles|customer_id/.test(entry.statement))).toBe(false)
  })

  it('links checkout and inquiry rows through contact_id without rewriting snapshots', async () => {
    const seen = []
    const db = {
      query: async (statement, values) => {
        seen.push({ statement, values })
        if (statement.includes('FROM public.products')) {
          return [{ id: '6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d', slug: 'banner', name: 'Banner', pricing_type: 'fixed', starting_price: '50000', currency: 'UGX', quote_required: false, min_quantity: 1, max_quantity: 1000 }]
        }
        if (statement.includes('customer_contacts')) return [{ id: 'contact-9' }]
        if (statement.startsWith('SELECT 1 FROM') || statement.includes('SELECT 1 FROM')) return []
        if (statement.includes('RETURNING')) return [{ id: 'row-1', request_number: 'QR-0001' }]
        return []
      },
      transaction: async (build) => {
        const queries = []
        const results = build({
          query: (statement, values = []) => {
            queries.push({ statement, values })
            seen.push({ statement, values })
            if (statement.includes('customer_contacts')) return Promise.resolve([{ id: 'contact-9' }])
            return Promise.resolve([{ id: 'order-1' }])
          },
        })
        await Promise.all(results)
        return results.map(() => [{ id: 'order-1', reference: 'MOT-K7P2QX' }])
      },
    }
    const api = createApi({ db, logger: silent })
    const response = await api(post('/api/orders', {
      items: [{ productId: '6f1a2f56-0f1e-4a0e-9a1f-4a4d1a2b3c4d', quantity: 2, selection: {} }],
      contact: { name: 'Amina Nakato', email: 'amina@example.com', phone: '+256700000000' },
      fulfilment: { method: 'collection' },
    }))
    expect(response.status).not.toBe(401)
    expect(response.status).not.toBe(403)
    expect(seen.some((entry) => entry.statement.includes('INSERT INTO public.customer_contacts'))).toBe(true)
    const writes = seen.filter((entry) => /INSERT INTO public\.(orders|quote_requests)/.test(entry.statement))
    expect(writes.length).toBeGreaterThan(0)
    for (const write of writes) {
      expect(write.statement).toContain('contact_id')
      expect(write.statement).not.toMatch(/\bcustomer_id\b/)
      expect(write.values).toContain('contact-9')
      expect(write.values).toContain('Amina Nakato')
      expect(write.values).toContain('amina@example.com')
    }
  })

  it('searches admin customers on contact fields and aggregates through contact_id', async () => {
    const seen = []
    const db = {
      query: async (statement, values) => {
        seen.push({ statement, values })
        return []
      },
    }
    const api = createApi({ db, authenticate: async () => ownerActor, logger: silent })
    await api(get('/api/admin/customers?q=amina'))
    expect(seen[0].statement).toContain('FROM public.customer_contacts')
    expect(seen[0].statement).toContain('o.contact_id = c.id')
    expect(seen[0].statement).toContain('display_name')
    expect(seen[0].statement).toContain('company_name')
    expect(seen[0].statement).not.toContain('user_profiles')
    expect(seen[0].statement).not.toContain('admin_login_attempts')
    expect(seen[0].statement).not.toContain('password')
  })
})
