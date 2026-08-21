import { describe, expect, it } from 'vitest'
import { createAuthenticator, requireAdmin, requireAuth, requireCustomer } from '../server/auth.js'
import { serverConfig } from '../server/config.js'
import { FAKE_ANON_KEY, FAKE_SERVICE_ROLE_KEY, FAKE_SUPABASE_URL, serverEnv } from './helpers/supabase.js'

/* Supabase Auth token verification.
 *
 * A real Supabase token cannot be minted here — the project requires email
 * confirmation, so obtaining one needs a reachable inbox and a browser. What is
 * fully testable, and is what actually protects the API, is our own verification
 * seam: `getUser(token)` is injectable, production passes `supabase.auth.getUser`.
 */

const bearer = (token) => new Request('https://api.test/x', { headers: { authorization: `Bearer ${token}` } })

function harness({ profile = null, user = null, getUser } = {}) {
  const authUser = user || {
    id: 'auth-user-1',
    email: 'ada@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
  }
  const queries = []
  const db = {
    query: async (statement, values) => {
      queries.push({ statement, values })
      return profile ? [profile] : []
    },
  }
  const lookup = getUser || (async (token) => {
    if (!token || token === 'invalid' || token === 'expired') return null
    return authUser
  })
  const authenticate = createAuthenticator({ db, getUser: lookup })
  return { authenticate, queries, authUser }
}

describe('Supabase Auth token verification', () => {
  it('accepts a token that getUser resolves and loads the profile from the database', async () => {
    const profile = { id: 'p1', auth_user_id: 'auth-user-1', role: 'customer', full_name: 'Ada' }
    const kit = harness({ profile })
    const actor = await kit.authenticate(bearer('valid-access-token'))
    expect(actor.authUserId).toBe('auth-user-1')
    expect(actor.profile).toEqual(profile)
    expect(actor.email).toBe('ada@example.com')
    expect(actor.emailVerified).toBe(true)
    expect(kit.queries[0].statement).toContain('FROM public.user_profiles')
    expect(kit.queries[0].values).toEqual(['auth-user-1'])
  })

  it('returns null rather than throwing when no token is presented', async () => {
    const kit = harness()
    expect(await kit.authenticate(new Request('https://api.test/x'))).toBeNull()
  })

  it('rejects a token that getUser does not resolve', async () => {
    const kit = harness()
    await expect(kit.authenticate(bearer('invalid'))).rejects.toMatchObject({ status: 401, code: 'invalid_session' })
  })

  it('rejects an expired or thrown lookup', async () => {
    const kit = harness({
      getUser: async () => { throw new Error('expired') },
    })
    await expect(kit.authenticate(bearer('expired'))).rejects.toMatchObject({ status: 401, code: 'invalid_session' })
  })

  it('rejects a user object with no id', async () => {
    const kit = harness({ getUser: async () => ({ email: 'ada@example.com' }) })
    await expect(kit.authenticate(bearer('no-sub'))).rejects.toMatchObject({ status: 401 })
  })
})

describe('authorisation is decided by the database, never by the token', () => {
  it('ignores a role claim on the Auth user and uses the stored profile role', async () => {
    const profile = { id: 'p1', auth_user_id: 'auth-user-1', role: 'customer' }
    const kit = harness({
      profile,
      user: {
        id: 'auth-user-1',
        email: 'ada@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
        app_metadata: { role: 'admin' },
        user_metadata: { role: 'owner', is_admin: true },
      },
    })
    const request = bearer('valid-access-token')
    const actor = await kit.authenticate(request)

    expect(actor.profile.role).toBe('customer')
    await expect(requireAdmin(request, kit.authenticate)).rejects.toMatchObject({ status: 403, code: 'owner_required' })
  })

  it('admits a caller whose stored role is owner', async () => {
    const kit = harness({ profile: { id: 'p2', auth_user_id: 'auth-user-1', role: 'owner' } })
    const request = bearer('valid-access-token')
    const actor = await requireAdmin(request, kit.authenticate)
    expect(actor.profile.role).toBe('owner')
  })

  it('requires a completed profile for customer routes, and any session for authenticated ones', async () => {
    const kit = harness({ profile: null })
    const request = bearer('valid-access-token')
    const actor = await requireAuth(request, kit.authenticate)
    expect(actor.profile).toBeNull()
    await expect(requireCustomer(request, kit.authenticate)).rejects.toMatchObject({ status: 403, code: 'profile_required' })
    await expect(requireAdmin(request, kit.authenticate)).rejects.toMatchObject({ status: 403, code: 'owner_required' })
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
  it('accepts a correctly formed Supabase URL and service_role key', () => {
    expect(() => serverConfig(serverEnv)).not.toThrow()
    const config = serverConfig(serverEnv)
    expect(config.supabaseUrl).toBe(FAKE_SUPABASE_URL)
    expect(config.supabaseServiceRoleKey).toBe(FAKE_SERVICE_ROLE_KEY)
  })

  it('rejects a Supabase URL that carries a path', () => {
    expect(() => serverConfig({ ...serverEnv, SUPABASE_URL: `${FAKE_SUPABASE_URL}/auth/v1` }))
      .toThrow(/origin with no path/)
  })

  it('rejects the publishable key in the service_role slot', () => {
    expect(() => serverConfig({ ...serverEnv, SUPABASE_SERVICE_ROLE_KEY: FAKE_ANON_KEY }))
      .toThrow(/not the service_role key/)
  })

  it('refuses to build an authenticator without a lookup', () => {
    const db = { query: async () => [] }
    expect(() => createAuthenticator({ db })).toThrow(/Supabase Auth client/)
    expect(() => createAuthenticator({ getUser: async () => null })).toThrow(/database client/)
  })
})
