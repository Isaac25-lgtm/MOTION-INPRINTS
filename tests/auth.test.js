import { describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { createAuthenticator, requireAdmin, requireAuth, requireCustomer } from '../server/auth.js'
import { serverConfig } from '../server/config.js'

/* Neon Auth (Managed Better Auth) token verification.
 *
 * A real Neon token cannot be minted here — the project requires email
 * verification, so obtaining one needs a reachable inbox and a browser. What is
 * fully testable, and is what actually protects the API, is our own verification:
 * a locally generated Ed25519 key is served as a JWKS from a throwaway HTTP
 * server, and tokens are signed against it.
 *
 * That exercises the same code path as production. The one thing it cannot prove
 * is that Neon's issuer string matches what we configured — see
 * ENVIRONMENT.md for the manual check that closes that gap.
 */

/** Serves a JWKS containing `jwk` and returns { url, close }. */
async function jwksServer(jwk) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ keys: [jwk] }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return {
    url: `http://127.0.0.1:${port}/.well-known/jwks.json`,
    close: () => new Promise(resolve => server.close(resolve)),
  }
}

const ISSUER = 'https://ep-test.neonauth.example.aws.neon.tech'
const bearer = (token) => new Request('https://api.test/x', { headers: { authorization: `Bearer ${token}` } })

/* Neon signs with EdDSA (Ed25519) — confirmed against the live JWKS, which
   serves a single OKP key. */
async function harness({ profile = null } = {}) {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })
  const jwk = { ...(await exportJWK(publicKey)), alg: 'EdDSA', kid: 'test-key' }
  const jwks = await jwksServer(jwk)

  const queries = []
  const db = { query: async (statement, values) => { queries.push({ statement, values }); return profile ? [profile] : [] } }
  const authenticate = createAuthenticator({ jwksUrl: jwks.url, issuer: ISSUER, db })

  const sign = ({ sub = 'auth-user-1', issuer = ISSUER, claims = {}, expiresIn = '5m' } = {}) =>
    new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
      .setIssuer(issuer)
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey)

  return { authenticate, sign, queries, close: jwks.close, privateKey }
}

describe('Neon Auth token verification', () => {
  it('accepts a correctly issued EdDSA token and resolves the profile from the database', async () => {
    const profile = { id: 'p1', auth_user_id: 'auth-user-1', role: 'customer', full_name: 'Ada' }
    const kit = await harness({ profile })
    try {
      const actor = await kit.authenticate(bearer(await kit.sign()))
      expect(actor.authUserId).toBe('auth-user-1')
      expect(actor.profile).toEqual(profile)
      // The role is read from our table, keyed on the token subject.
      expect(kit.queries[0].statement).toContain('FROM public.user_profiles')
      expect(kit.queries[0].values).toEqual(['auth-user-1'])
    } finally { await kit.close() }
  })

  it('returns null rather than throwing when no token is presented', async () => {
    const kit = await harness()
    try {
      expect(await kit.authenticate(new Request('https://api.test/x'))).toBeNull()
    } finally { await kit.close() }
  })

  /* The issuer is the ORIGIN of the Neon Auth URL, not the auth URL itself.
     Getting that wrong is the likeliest configuration error, so it must fail
     closed rather than be tolerated. */
  it('rejects a token whose issuer is the auth URL rather than its origin', async () => {
    const kit = await harness()
    try {
      const token = await kit.sign({ issuer: `${ISSUER}/neondb/auth` })
      await expect(kit.authenticate(bearer(token))).rejects.toMatchObject({ status: 401 })
    } finally { await kit.close() }
  })

  it('rejects an expired token', async () => {
    const kit = await harness()
    try {
      const token = await kit.sign({ expiresIn: '-1m' })
      await expect(kit.authenticate(bearer(token))).rejects.toMatchObject({ status: 401, code: 'invalid_session' })
    } finally { await kit.close() }
  })

  it('rejects a token with no subject', async () => {
    const kit = await harness()
    try {
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
        .setIssuer(ISSUER).setIssuedAt().setExpirationTime('5m')
        .sign(kit.privateKey)
      await expect(kit.authenticate(bearer(token))).rejects.toMatchObject({ status: 401 })
    } finally { await kit.close() }
  })

  it('rejects a signature from a key that is not in the JWKS', async () => {
    const kit = await harness()
    try {
      const other = await generateKeyPair('EdDSA', { crv: 'Ed25519' })
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
        .setIssuer(ISSUER).setSubject('auth-user-1').setIssuedAt().setExpirationTime('5m')
        .sign(other.privateKey)
      await expect(kit.authenticate(bearer(token))).rejects.toMatchObject({ status: 401 })
    } finally { await kit.close() }
  })

  it('rejects an unsigned token, so alg:none cannot bypass verification', async () => {
    const kit = await harness()
    try {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
      const body = Buffer.from(JSON.stringify({ iss: ISSUER, sub: 'auth-user-1', exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url')
      await expect(kit.authenticate(bearer(`${header}.${body}.`))).rejects.toMatchObject({ status: 401 })
    } finally { await kit.close() }
  })
})

describe('authorisation is decided by the database, never by the token', () => {
  /* The decisive test. A Neon Auth user object carries its own `role` field,
     which belongs to Better Auth and has nothing to do with Motion's. If any of
     that reached our authorisation check, a signed-in customer could mint
     administrator access by influencing identity-side state. */
  it('ignores a role claim in the token and uses the stored profile role', async () => {
    const profile = { id: 'p1', auth_user_id: 'auth-user-1', role: 'customer' }
    const kit = await harness({ profile })
    try {
      const token = await kit.sign({ claims: { role: 'admin', is_admin: true, profile: { role: 'admin' } } })
      const request = bearer(token)
      const actor = await kit.authenticate(request)

      expect(actor.profile.role).toBe('customer')
      await expect(requireAdmin(request, kit.authenticate)).rejects.toMatchObject({ status: 403, code: 'owner_required' })
    } finally { await kit.close() }
  })

  it('admits a caller whose stored role is owner', async () => {
    const kit = await harness({ profile: { id: 'p2', auth_user_id: 'auth-user-1', role: 'owner' } })
    try {
      const request = bearer(await kit.sign())
      const actor = await requireAdmin(request, kit.authenticate)
      expect(actor.profile.role).toBe('owner')
    } finally { await kit.close() }
  })

  it('requires a completed profile for customer routes, and any session for authenticated ones', async () => {
    const kit = await harness({ profile: null })
    try {
      const request = bearer(await kit.sign())
      // Authenticated, but no Motion profile yet — a first sign-in.
      const actor = await requireAuth(request, kit.authenticate)
      expect(actor.profile).toBeNull()
      await expect(requireCustomer(request, kit.authenticate)).rejects.toMatchObject({ status: 403, code: 'profile_required' })
      await expect(requireAdmin(request, kit.authenticate)).rejects.toMatchObject({ status: 403, code: 'owner_required' })
    } finally { await kit.close() }
  })
})

describe('a customer cannot promote themselves through the API', () => {
  const silentLogger = { info() {}, error() {} }
  const apiRequest = (path, options) => new Request(`https://api.motion.test${path}`, options)
  const json = (body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  it('drops a role sent to profile creation and stores customer', async () => {
    const { createApi } = await import('../server/api.js')
    const seen = []
    const db = { query: async (statement, values) => { seen.push({ statement, values }); return [{ id: 'p', role: 'customer' }] } }
    const api = createApi({
      db,
      authenticate: async () => ({ authUserId: 'auth-1', profile: null }),
      logger: silentLogger,
    })

    await api(apiRequest('/api/me', json({ fullName: 'Mallory', role: 'admin', profile: { role: 'admin' } })))

    const insert = seen.find(entry => entry.statement.includes('INSERT INTO public.user_profiles'))
    expect(insert, 'no profile insert was issued').toBeTruthy()
    /* The role is a literal in the handler, not taken from the body, and the
       schema strips unknown keys — so 'admin' never reaches the parameters. */
    expect(insert.values).toContain('customer')
    expect(insert.values).not.toContain('admin')
  })

  it('cannot change its own role through the profile PATCH', async () => {
    const { createApi } = await import('../server/api.js')
    const seen = []
    const db = { query: async (statement, values) => { seen.push({ statement, values }); return [{ id: 'p', role: 'customer' }] } }
    const api = createApi({
      db,
      authenticate: async () => ({ authUserId: 'auth-1', profile: { id: 'p', role: 'customer' } }),
      logger: silentLogger,
    })

    await api(apiRequest('/api/me', { ...json({ fullName: 'Mallory', role: 'admin' }), method: 'PATCH' }))

    const update = seen.find(entry => entry.statement.includes('UPDATE public.user_profiles'))
    expect(update).toBeTruthy()
    expect(update.statement).not.toMatch(/SET[^)]*\brole\s*=/)
    expect(update.values).not.toContain('admin')
  })

  it('refuses an admin route to a customer session', async () => {
    const { createApi } = await import('../server/api.js')
    const api = createApi({
      db: { query: async () => [] },
      authenticate: async () => ({ authUserId: 'auth-1', profile: { id: 'p', role: 'customer' } }),
      logger: silentLogger,
    })
    const response = await api(apiRequest('/api/admin/products'))
    expect(response.status).toBe(403)
  })
})

describe('server configuration is validated at startup', () => {
  const base = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    NEON_AUTH_JWKS_URL: `${ISSUER}/neondb/auth/.well-known/jwks.json`,
    NEON_AUTH_ISSUER: ISSUER,
  }

  it('accepts a correctly split JWKS URL and issuer', () => {
    expect(() => serverConfig(base)).not.toThrow()
  })

  /* The mistake this exists to catch: the same value pasted into both. Tokens
     then verify cryptographically and fail on the issuer claim, which presents
     as a broken login rather than as a misconfiguration. */
  it('rejects an issuer that carries a path', () => {
    expect(() => serverConfig({ ...base, NEON_AUTH_ISSUER: `${ISSUER}/neondb/auth` }))
      .toThrow(/must be an origin with no path/)
  })

  it('rejects a JWKS URL that is not the well-known path', () => {
    expect(() => serverConfig({ ...base, NEON_AUTH_JWKS_URL: `${ISSUER}/neondb/auth` }))
      .toThrow(/\.well-known\/jwks\.json/)
  })

  it('rejects a JWKS URL and issuer from different origins', () => {
    expect(() => serverConfig({ ...base, NEON_AUTH_JWKS_URL: 'https://elsewhere.example/.well-known/jwks.json' }))
      .toThrow(/must share an origin/)
  })

  it('refuses to build an authenticator without both values', () => {
    const db = { query: async () => [] }
    expect(() => createAuthenticator({ jwksUrl: '', issuer: ISSUER, db })).toThrow(/NEON_AUTH_JWKS_URL/)
    expect(() => createAuthenticator({ jwksUrl: base.NEON_AUTH_JWKS_URL, issuer: '', db })).toThrow(/NEON_AUTH_ISSUER/)
  })
})
