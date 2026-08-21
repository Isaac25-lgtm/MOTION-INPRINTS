import { describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApi } from '../server/api.js'

/* Guest-first.
 *
 * Motion sells to people who have never signed in and never will. An account is
 * a convenience — saved details, history, proofs, reordering — and must never
 * become a condition of buying. These tests exist because that is exactly the
 * kind of requirement that gets added by accident, one guard at a time.
 *
 * Anonymous here means anonymous: `authenticate` returns null, as it does for a
 * request carrying no Authorization header at all.
 */

const silent = { info() {}, error() {} }
const anonymous = async () => null
const req = (path, options) => new Request(`https://api.motion.test${path}`, options)
const post = (path, body) => req(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const read = async (response) => ({ status: response.status, ...(await response.json().catch(() => ({}))) })

/** Enough of a database for pricing and insertion to complete. */
function commerceDb() {
  const seen = []
  return {
    seen,
    query: async (statement, values = []) => {
      seen.push({ statement, values })
      if (statement.includes('FROM public.products')) {
        return [{ id: 'prod-1', slug: 'banner', name: 'Banner', pricing_type: 'fixed', starting_price: '50000', currency: 'UGX', quote_required: false, min_quantity: 1, max_quantity: 1000 }]
      }
      if (statement.includes('product_options') || statement.includes('pricing_components') || statement.includes('compatibility')) return []
      if (statement.includes('idempotency_keys')) return []
      if (statement.includes('RETURNING')) return [{ id: 'row-1', reference: 'MOT-K7P2QX', request_number: 'QR-0001' }]
      return []
    },
    transaction: async (build) => {
      const queries = []
      await build({ query: (statement, values = []) => { queries.push({ statement, values }); seen.push({ statement, values }); return Promise.resolve([{ id: 'row-1', reference: 'MOT-K7P2QX' }]) } })
      return [[{ id: 'order-1', reference: 'MOT-K7P2QX' }]]
    },
  }
}

describe('public browsing needs no session', () => {
  const api = createApi({ db: commerceDb(), authenticate: anonymous, logger: silent })

  it('serves catalogue, categories, services, search and tracking anonymously', async () => {
    for (const path of ['/api/products', '/api/categories', '/api/services', '/api/search?q=banner', '/api/content/public', '/api/projects']) {
      const response = await api(req(path))
      expect([200, 404], `${path} must not demand a session (got ${response.status})`).toContain(response.status)
      expect(response.status, `${path} must not be 401/403 for a guest`).not.toBe(401)
      expect(response.status).not.toBe(403)
    }
  })

  it('prices a configuration for a guest', async () => {
    const response = await api(post('/api/pricing/calculate', { productId: 'prod-1', quantity: 10, selection: {} }))
    expect(response.status).not.toBe(401)
    expect(response.status).not.toBe(403)
  })

  it('validates a cart for a guest', async () => {
    const response = await api(post('/api/cart/validate', { items: [{ productId: 'prod-1', quantity: 5, selection: {} }] }))
    expect(response.status).not.toBe(401)
    expect(response.status).not.toBe(403)
  })
})

describe('guest checkout and requests', () => {
  /* The decisive one. If a guard is ever added to checkout, this fails. */
  it('places an order without a session', async () => {
    const db = commerceDb()
    const api = createApi({ db, authenticate: anonymous, logger: silent })
    const response = await api(post('/api/orders', {
      items: [{ productId: 'prod-1', quantity: 10, selection: {} }],
      contact: { name: 'Amina Nakato', email: 'amina@example.com', phone: '+256700000000' },
      fulfilment: { method: 'delivery', address: 'Kampala' },
    }))

    const result = await read(response)
    expect(result.status, 'guest checkout must never require authentication').not.toBe(401)
    expect(result.status, 'guest checkout must never require a profile').not.toBe(403)
  })

  it('submits a quote request without a session', async () => {
    const api = createApi({ db: commerceDb(), authenticate: anonymous, logger: silent })
    const result = await read(await api(post('/api/quote-requests', {
      contactName: 'Amina Nakato', contactEmail: 'amina@example.com', message: 'Two pull-up banners please.',
    })))
    expect(result.status).not.toBe(401)
    expect(result.status).not.toBe(403)
  })

  it('submits a custom project intake without a session', async () => {
    const api = createApi({ db: commerceDb(), authenticate: anonymous, logger: silent })
    const result = await read(await api(post('/api/quote-requests', {
      projectType: 'signage', contactName: 'Amina Nakato', contactEmail: 'amina@example.com',
      message: 'Shopfront sign for a new branch.', answers: {},
    })))
    expect(result.status).not.toBe(401)
    expect(result.status).not.toBe(403)
  })

  /* Tracking is reference + token, never a session. */
  it('tracks an order with a reference and token, not a login', async () => {
    const api = createApi({ db: commerceDb(), authenticate: anonymous, logger: silent })
    const response = await api(req('/api/track/MOT-K7P2QX?token=abc'))
    expect(response.status).not.toBe(401)
    expect(response.status).not.toBe(403)
  })
})

describe('anonymous callers cannot reach private or manager APIs', () => {
  it('rejects /api/me and manager data without a session', async () => {
    const api = createApi({ db: commerceDb(), authenticate: anonymous, logger: silent })
    expect((await api(req('/api/me'))).status).toBe(401)
    expect((await api(req('/api/admin/products'))).status).toBe(401)
    expect((await api(req('/api/admin/orders'))).status).toBe(401)
    expect((await api(req('/api/staff/bootstrap', { method: 'POST' }))).status).toBe(401)
  })
})

describe('the source code does not reintroduce a login wall', () => {
  const walk = async (dir, files = []) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path, files)
      else if (/\.jsx?$/.test(entry.name)) files.push(path)
    }
    return files
  }

  it('never wraps a purchase route in an authentication guard', async () => {
    const app = await readFile(fileURLToPath(new URL('../src/App.jsx', import.meta.url)), 'utf8')
    /* Each of these must be reachable by a guest. A RequireAuth wrapper around
       any of them would be a silent conversion killer. */
    for (const route of ['/cart', '/checkout', '/custom-project', '/quote', '/track-order', '/shop', '/product/:slug']) {
      const line = app.split('\n').find(l => l.includes(`path="${route}"`))
      expect(line, `route ${route} not found`).toBeTruthy()
      expect(line, `${route} must stay public`).not.toMatch(/RequireAuth|RequireOwner|RequireAdmin/)
    }
  })

  it('labels the header account control neutrally rather than as a sign-in demand', async () => {
    const header = await readFile(fileURLToPath(new URL('../src/layouts/SiteHeader.jsx', import.meta.url)), 'utf8')
    expect(header).toContain('label="Account"')
    // "Sign in" as the anonymous label implies a requirement that does not exist.
    expect(header).not.toMatch(/isAuthenticated \? 'Your account' : 'Sign in'/)
  })

  it('states on both auth pages that an account is optional', async () => {
    const auth = await readFile(fileURLToPath(new URL('../src/pages/AuthPages.jsx', import.meta.url)), 'utf8')
    const mentions = auth.match(/Creating an account is optional/g) || []
    expect(mentions.length, 'sign-in and sign-up must both say it').toBe(2)
    expect(auth).toMatch(/place an order\s*\n?\s*and track it as a guest/)
  })

  it('never links the management area from public chrome', async () => {
    for (const file of ['../src/layouts/SiteHeader.jsx', '../src/layouts/SiteFooter.jsx']) {
      const source = await readFile(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
      expect(source, `${file} must not advertise the management area`).not.toMatch(/\/manager/)
    }
    // Nor from the customer account area.
    const account = await readFile(fileURLToPath(new URL('../src/pages/account/AccountPages.jsx', import.meta.url)), 'utf8')
    expect(account).not.toMatch(/\/manager/)
  })
})

describe('digital-first ordering', () => {
  it('orders categories from the database, not from a hand-sorted array', async () => {
    const seen = []
    const db = { query: async (statement, values = []) => { seen.push(statement); return [] } }
    await createApi({ db, authenticate: anonymous, logger: silent })(req('/api/categories'))
    const categories = seen.find(s => s.includes('FROM public.categories'))
    expect(categories, 'category listing must sort in SQL').toMatch(/ORDER BY sort_order/)
  })

  it('puts Digital Solutions first in the migration that sets the order', async () => {
    const sql = await readFile(fileURLToPath(new URL('../db/migrations/0013_owner_role_and_digital_first.sql', import.meta.url)), 'utf8')
    const order = ['digital-solutions', 'printing', 'signage', 'promotional-display', 'apparel', 'decor', 'design']
    const positions = order.map(slug => {
      const match = sql.match(new RegExp(`SET sort_order = (\\d+)[^;]*WHERE slug = '${slug}'`))
      expect(match, `${slug} has no sort_order in the migration`).toBeTruthy()
      return Number(match[1])
    })
    // Strictly ascending in the intended order.
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(positions[0]).toBeLessThan(positions[1])
  })

  it('adds Digital Marketing and broadens POS into Business Systems', async () => {
    const sql = await readFile(fileURLToPath(new URL('../db/migrations/0013_owner_role_and_digital_first.sql', import.meta.url)), 'utf8')
    expect(sql).toMatch(/'Digital Marketing', 'digital-marketing'/)
    // Guarded so re-running cannot insert it twice.
    expect(sql).toMatch(/NOT EXISTS[\s\S]*digital-marketing/)
    expect(sql).toMatch(/name = 'Business Systems'/)
    expect(sql).toMatch(/slug = 'business-systems'/)
  })

  it('leads the hero, navigation, footer and rail with digital', async () => {
    const home = await readFile(fileURLToPath(new URL('../src/pages/HomePage.jsx', import.meta.url)), 'utf8')
    const statement = home.slice(home.indexOf('const statement'), home.indexOf('return (', home.indexOf('const statement')))
    const words = [...statement.matchAll(/word: '(\w+)'/g)].map(m => m[1])
    expect(words).toEqual(['Digital', 'Design', 'Print', 'Brand'])
    expect(home).toContain('Kampala · Digital, design, print &amp; brand')
    expect(home).toMatch(/Websites, e-commerce, digital marketing and business systems/)

    // Digital Solutions is the first service link in nav, footer and rail.
    const first = async (file, pattern) => {
      const source = await readFile(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
      return source.match(pattern)?.[1]
    }
    expect(await first('../src/layouts/SiteHeader.jsx', /\{ to: '\/services\/([a-z-]+)'/)).toBe('digital-solutions')
    expect(await first('../src/layouts/SiteFooter.jsx', /\{ to: '\/services\/([a-z-]+)'/)).toBe('digital-solutions')
    const rail = await readFile(fileURLToPath(new URL('../src/features/home/ProductionRail.jsx', import.meta.url)), 'utf8')
    expect(rail.match(/label: '([^']+)'/)[1]).toBe('Digital systems')
  })

  it('offers digital services quote-first, with no invented price or package', async () => {
    const home = await readFile(fileURLToPath(new URL('../src/pages/HomePage.jsx', import.meta.url)), 'utf8')
    const section = home.slice(home.indexOf('function DigitalSolutions'), home.indexOf('function Process'))
    expect(section).toContain('digital-marketing')
    expect(section).toContain('business-systems')
    expect(section, 'POS must not be the whole positioning').not.toMatch(/Point-of-sale systems<|business-point-of-sale-systems/)
    /* No fabricated pricing in what actually renders. Comments are stripped
       first — the source comment explains that no price is stated, and matching
       the word "package" inside that explanation is not a finding. */
    const rendered = section.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(rendered).not.toMatch(/UGX\s*[\d,]|from UGX|starting at|per month|package/i)
  })
})

describe('digital request types are usable by guests', () => {
  const submit = (projectType, extra = {}) => {
    const api = createApi({ db: commerceDb(), authenticate: anonymous, logger: silent })
    return api(post('/api/quote-requests', {
      projectType,
      contactName: 'Amina Nakato',
      contactEmail: 'amina@example.com',
      projectBrief: 'A clear description of what the business needs building.',
      answers: extra,
    }))
  }

  it('accepts a digital marketing request with no session', async () => {
    const result = await read(await submit('digital_marketing', { audience: 'Retail customers in Kampala', channels: 'Instagram' }))
    expect(result.status, 'guests must be able to request digital marketing').not.toBe(401)
    expect(result.status).not.toBe(403)
    expect(result.status).not.toBe(422)
  })

  it('accepts a business systems request with no session', async () => {
    const result = await read(await submit('business_systems', { systemNeed: 'Stock across two branches' }))
    expect(result.status).not.toBe(401)
    expect(result.status).not.toBe(403)
    expect(result.status).not.toBe(422)
  })

  /* Saved rows may already carry the retired value; dropping it from the enum
     would turn existing data into validation failures. */
  it('still accepts the legacy pos value', async () => {
    const result = await read(await submit('pos'))
    expect(result.status).not.toBe(422)
  })

  it('rejects a project type that does not exist', async () => {
    const result = await read(await submit('teleportation'))
    expect(result.status).toBe(422)
  })

  it('offers both new types in the public form, and no longer names POS as the whole offering', async () => {
    const form = await readFile(fileURLToPath(new URL('../src/pages/CustomProjectPage.jsx', import.meta.url)), 'utf8')
    expect(form).toContain("value: 'digital_marketing'")
    expect(form).toContain("value: 'business_systems'")
    expect(form).toContain("label: 'Business systems'")
    expect(form, 'POS must not be the label').not.toContain("label: 'POS / business system'")
    // Digital options come first in the list.
    const order = [...form.matchAll(/\{ value: '(\w+)', label:/g)].map(m => m[1])
    expect(order.slice(0, 4)).toEqual(['website', 'ecommerce', 'digital_marketing', 'business_systems'])
  })
})

describe('quote-first categories do not lead to an empty shop', () => {
  it('routes Digital Solutions to services and physical categories to the shop', async () => {
    const cards = await readFile(fileURLToPath(new URL('../src/components/ui/Cards.jsx', import.meta.url)), 'utf8')
    const body = cards.slice(cards.indexOf('const QUOTE_FIRST_CATEGORIES'), cards.indexOf('export function CategoryTile'))
    // `export` is not valid inside a Function body; the declaration alone is.
    const href = new Function(`${body.replace(/export /g, '')} return categoryHref`)()

    expect(href('digital-solutions')).toBe('/services/digital-solutions')
    expect(href('design')).toBe('/services/design')
    // Everything purchasable still goes to the catalogue.
    for (const slug of ['printing', 'signage', 'apparel', 'promotional-display', 'decor']) {
      expect(href(slug)).toBe(`/shop/${slug}`)
    }
  })

  it('uses that helper for the tile rather than a hardcoded shop link', async () => {
    const cards = await readFile(fileURLToPath(new URL('../src/components/ui/Cards.jsx', import.meta.url)), 'utf8')
    const tile = cards.slice(cards.indexOf('export function CategoryTile'), cards.indexOf('export function Badge'))
    expect(tile).toContain('categoryHref(category.slug)')
    expect(tile).not.toMatch(/to=\{`\/shop\/\$\{category\.slug\}`\}/)
  })
})

describe('legacy links keep working', () => {
  it('redirects the retired point-of-sale slugs', async () => {
    const app = await readFile(fileURLToPath(new URL('../src/App.jsx', import.meta.url)), 'utf8')
    for (const from of ['/services/business-point-of-sale-systems', '/shop/business-point-of-sale-systems']) {
      const line = app.split('\n').find(l => l.includes(`path="${from}"`))
      expect(line, `${from} must not 404`).toBeTruthy()
      expect(line).toContain('Navigate')
      expect(line).toContain('business-systems')
    }
  })
})

describe('digital-first copy across public pages', () => {
  const page = (file) => readFile(fileURLToPath(new URL(file, import.meta.url)), 'utf8')

  it('leads with digital on Services, About and the footer', async () => {
    const services = await page('../src/pages/ServicesPage.jsx')
    expect(services).toContain('Digital, design, print and brand')
    expect(services).toMatch(/Websites, e-commerce, digital marketing and business systems/)

    const about = await page('../src/pages/AboutPage.jsx')
    expect(about).toContain('A digital and production studio in Kampala')
    // Digital is the first capability listed.
    const first = about.match(/\{ title: '([^']+)'/)[1]
    expect(first).toBe('Digital solutions')

    const footer = await page('../src/layouts/SiteFooter.jsx')
    expect(footer).toMatch(/Digital, design, print and brand production in Kampala/)
  })

  it('makes no unsupported claim of leadership or scale', async () => {
    for (const file of ['../src/pages/ServicesPage.jsx', '../src/pages/AboutPage.jsx', '../src/pages/HomePage.jsx', '../src/layouts/SiteFooter.jsx']) {
      const source = (await page(file)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(source, `${file} must not claim leadership`).not.toMatch(/\b(pioneer|leading|market leader|number one|best in|award-winning|world-class)\b/i)
    }
  })
})
