// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/* Paths are resolved from the working directory, not `import.meta.url`. Under
   jsdom `import.meta.url` is not a file: URL, so fileURLToPath throws — which is
   why the rest of the suite can use it and this file cannot. */
const projectFile = (relative) => join(process.cwd(), relative)

/* The JWT hand-off: session -> token -> Authorization header.
 *
 * This is the seam where a silent failure costs everything. The browser holds an
 * HTTP-only cookie for the Neon Auth origin; our API is a different origin and
 * never sees it, so every authenticated request depends on exchanging that
 * session for a short-lived JWT and attaching it as a bearer token.
 *
 * When that exchange returns null the request still goes out — just without the
 * header — and the API answers `authentication_required`. Nothing throws and
 * nothing is logged, so the symptom is a signed-in user who appears signed out.
 *
 * The specific fragility: `client.token()` is an SDK wrapper around Better Auth,
 * and the response shape is not guaranteed across versions. Reading only
 * `data.token` silently yields null if the wrapper returns the payload
 * unwrapped. These tests pin the header, not the shape.
 */

const calls = []

vi.mock('../src/services/apiClient.js', async (importOriginal) => await importOriginal())

beforeEach(() => { calls.length = 0 })

describe('token extraction accepts JWTs and refuses anything else', () => {
  const JWT = 'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ1c2VyLTEifQ.signature'

  /* Extracted from source rather than imported: authClient reads
     import.meta.env, which only exists under Vite's transform. */
  const extractor = async () => {
    const source = await readFile(projectFile('src/auth/authClient.js'), 'utf8')
    const body = source.slice(source.indexOf('const looksLikeJwt'), source.indexOf('export const authClient'))
    return new Function(`${body}; return extractJwt`)()
  }

  it('reads the session JWT from every documented shape', async () => {
    const extract = await extractor()
    // Neon documents the session JWT as session.access_token.
    expect(extract({ data: { session: { access_token: JWT } } })).toBe(JWT)
    expect(extract({ session: { access_token: JWT } })).toBe(JWT)
    // And the shapes the /token endpoint may return.
    expect(extract({ data: { session: { token: JWT } } })).toBe(JWT)
    expect(extract({ session: { token: JWT } })).toBe(JWT)
    expect(extract({ data: { token: JWT } })).toBe(JWT)
    expect(extract({ token: JWT })).toBe(JWT)
    expect(extract(JWT)).toBe(JWT)
    expect(extract({ data: JWT })).toBe(JWT)
  })

  /* The one that matters most.
   *
   * Better Auth's `session.token` is an OPAQUE session identifier, not a JWT —
   * confirmed against this project's own neon_auth.session rows, which hold
   * 32-character strings with no dots. Returning it would send
   * `Authorization: Bearer <opaque>`, which the server rejects on verification,
   * and would skip the client.token() fallback that produces a real JWT. */
  it('refuses an opaque session token so it can never be sent as a credential', async () => {
    const extract = await extractor()
    const OPAQUE = 'DKbFFqw1Tz6yAbCdEfGhIjKlMnOpQrSt'   // 32 chars, no dots
    expect(OPAQUE).toHaveLength(32)
    expect(extract({ data: { session: { token: OPAQUE } } })).toBeNull()
    expect(extract({ session: { token: OPAQUE } })).toBeNull()
    expect(extract({ token: OPAQUE })).toBeNull()
    expect(extract(OPAQUE)).toBeNull()
  })

  it('yields null for an error, empty or anonymous response', async () => {
    const extract = await extractor()
    for (const value of [{ data: null, error: { status: 401 } }, {}, null, undefined, '', { data: {} }]) {
      expect(extract(value)).toBeNull()
    }
  })
})

describe('the session JWT is preferred over a second round trip', () => {
  const JWT = 'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ1c2VyLTEifQ.signature'

  /* Reading the JWT off the restored session avoids a separate cross-origin
     request whose cookie handling is the fragile part. token() stays as the
     fallback — it is the correct public endpoint for this SDK. */
  it('calls getSession() before falling back to token()', async () => {
    const source = await readFile(projectFile('src/auth/authClient.js'), 'utf8')
    const fn = source.slice(source.indexOf('async token()'), source.indexOf('async signOut()'))
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    const sessionAt = fn.indexOf('client.getSession()')
    const tokenAt = fn.indexOf('client.token()')
    expect(sessionAt, 'getSession must be attempted').toBeGreaterThan(-1)
    expect(tokenAt, 'token() must remain as the fallback').toBeGreaterThan(-1)
    expect(sessionAt, 'getSession must come first').toBeLessThan(tokenAt)

    // Still the correct endpoint for this SDK.
    expect(fn, 'getJWTToken belongs to createInternalNeonAuth and 404s here').not.toContain('getJWTToken')
  })

  it('returns early on a session JWT, and only then tries the fallback', async () => {
    const source = await readFile(projectFile('src/auth/authClient.js'), 'utf8')
    const fn = source.slice(source.indexOf('async token()'), source.indexOf('async signOut()'))
    // An early return is what makes the fallback conditional rather than always run.
    expect(fn).toMatch(/if \(sessionToken\) return sessionToken/)
  })
})

describe('the API client attaches the bearer token', () => {
  /* The decisive test. If the hand-off breaks, this fails — where previously the
     only signal was a 401 in a server log. */
  it('sends Authorization: Bearer <JWT> once a session is restored', async () => {
    const { request, setAuthTokenProvider } = await import('../src/services/apiClient.js')

    globalThis.fetch = vi.fn(async (url, init) => {
      calls.push({ url: String(url), headers: init?.headers || {} })
      return new Response(JSON.stringify({ data: { id: 'p1', role: 'owner' } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    })

    // A restored session yields a JWT, exactly as AuthProvider wires it.
    setAuthTokenProvider(async () => 'restored-session-jwt')
    await request('/me')

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/me')
    expect(calls[0].headers.authorization, '/me must carry the bearer token').toBe('Bearer restored-session-jwt')
  })

  /* An anonymous visitor must still reach the public API — guest checkout
     depends on it — so a missing token means no header, not a blocked request. */
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

  /* The provider is asynchronous — minting a JWT is a network call. Awaiting it
     is not optional: a promise is truthy, so a missed await ships the header as
     `Bearer [object Promise]`, which fails as a malformed credential rather than
     as a missing one. */
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
    /* No body at all: the server resolves identity from the verified session and
       would ignore anything sent. */
    expect(calls[0].body).toBeUndefined()
    expect(result.owner).toBe(true)
  })

  it('sends the manager sign-in page through that service after Google returns', async () => {
    const source = await readFile(projectFile('src/pages/ManagerSignInPage.jsx'), 'utf8')
    // Google redirects back with a session; the page bootstraps on arrival.
    expect(source).toContain('staffService.bootstrap()')
    expect(source).toMatch(/isAuthenticated && !isOwner/)
    expect(source).toContain("signInWithGoogle({ next: '/manager' })")
  })
})
