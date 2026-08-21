// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const projectFile = (relative) => join(process.cwd(), relative)

/* The JWT hand-off: session -> access_token -> Authorization header.
 *
 * The browser holds a Supabase session; our API is a different origin and never
 * sees it, so every authenticated request depends on reading
 * `session.access_token` and attaching it as a bearer token.
 */

const calls = []

beforeEach(() => { calls.length = 0 })

describe('token extraction accepts JWTs and refuses anything else', () => {
  const JWT = 'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ1c2VyLTEifQ.signature'

  const extractor = async () => {
    const source = await readFile(projectFile('src/auth/authClient.js'), 'utf8')
    const body = source.slice(source.indexOf('const looksLikeJwt'), source.indexOf('function presentUser'))
    return new Function(`${body.replace(/export /g, '')}; return extractJwt`)()
  }

  it('reads the session access token from documented shapes', async () => {
    const extract = await extractor()
    expect(extract({ data: { session: { access_token: JWT } } })).toBe(JWT)
    expect(extract({ session: { access_token: JWT } })).toBe(JWT)
    expect(extract({ data: { access_token: JWT } })).toBe(JWT)
    expect(extract({ access_token: JWT })).toBe(JWT)
    expect(extract(JWT)).toBe(JWT)
  })

  it('refuses an opaque session token so it can never be sent as a credential', async () => {
    const extract = await extractor()
    const OPAQUE = 'DKbFFqw1Tz6yAbCdEfGhIjKlMnOpQrSt'
    expect(OPAQUE).toHaveLength(32)
    expect(extract({ data: { session: { token: OPAQUE } } })).toBeNull()
    expect(extract({ session: { token: OPAQUE } })).toBeNull()
    expect(extract({ token: OPAQUE })).toBeNull()
    expect(extract(OPAQUE)).toBeNull()
    expect(extract({ data: { session: { refresh_token: JWT } } })).toBeNull()
  })

  it('yields null for an error, empty or anonymous response', async () => {
    const extract = await extractor()
    for (const value of [{ data: null, error: { status: 401 } }, {}, null, undefined, '', { data: {} }]) {
      expect(extract(value)).toBeNull()
    }
  })
})

describe('the session access token is what authorises the Motion API', () => {
  it('reads access_token from getSession and does not call a Neon token endpoint', async () => {
    const source = await readFile(projectFile('src/auth/authClient.js'), 'utf8')
    const fn = source.slice(source.indexOf('async token()'), source.indexOf('async signOut()'))
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    expect(fn).toContain('client.auth.getSession()')
    expect(fn).not.toContain('client.token()')
    expect(fn).not.toContain('getJWTToken')
    expect(source).toContain('@supabase/supabase-js')
    expect(source).not.toContain('@neondatabase')
  })
})

describe('the API client attaches the bearer token', () => {
  it('sends Authorization: Bearer <JWT> once a session is restored', async () => {
    const { request, setAuthTokenProvider } = await import('../src/services/apiClient.js')

    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url: String(url), headers: init?.headers || {} })
      return new Response(JSON.stringify({ data: { id: 'p1', role: 'owner' } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    })

    setAuthTokenProvider(async () => 'restored-session-jwt')
    await request('/me')

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/me')
    expect(calls[0].headers.authorization, '/me must carry the bearer token').toBe('Bearer restored-session-jwt')
  })

  it('omits the header entirely when there is no session', async () => {
    const { request, setAuthTokenProvider } = await import('../src/services/apiClient.js')
    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url: String(url), headers: init?.headers || {} })
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    })

    setAuthTokenProvider(async () => null)
    await request('/products')

    expect(calls[0].headers.authorization).toBeUndefined()
  })

  it('awaits the provider rather than sending a promise', async () => {
    const { request, setAuthTokenProvider } = await import('../src/services/apiClient.js')
    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ headers: init?.headers || {} })
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    })

    setAuthTokenProvider(async () => { await new Promise(r => setTimeout(r, 5)); return 'late-jwt' })
    await request('/me')

    expect(calls[0].headers.authorization).toBe('Bearer late-jwt')
    expect(calls[0].headers.authorization).not.toContain('[object Promise]')
  })
})

describe('manager Google sign-in reaches the staff bootstrap', () => {
  it('posts to /staff/bootstrap with the bearer token and no body', async () => {
    const { setAuthTokenProvider } = await import('../src/services/apiClient.js')
    const { staffService } = await import('../src/services/staffService.js')

    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url: String(url), method: init?.method, headers: init?.headers || {}, body: init?.body })
      return new Response(JSON.stringify({ data: { owner: true, profile: { role: 'owner' } } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    })

    setAuthTokenProvider(async () => 'owner-jwt')
    const result = await staffService.bootstrap()

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/staff/bootstrap')
    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers.authorization, 'bootstrap must be authenticated').toBe('Bearer owner-jwt')
    expect(calls[0].body).toBeUndefined()
    expect(result.owner).toBe(true)
  })

  it('sends the manager sign-in page through that service after Google returns', async () => {
    const source = await readFile(projectFile('src/pages/ManagerSignInPage.jsx'), 'utf8')
    expect(source).toContain('staffService.bootstrap()')
    expect(source).toMatch(/isAuthenticated && !isOwner/)
    expect(source).toContain("signInWithGoogle({ next: '/manager' })")
  })
})
