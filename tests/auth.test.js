import { describe, expect, it } from 'vitest'
import { createAuthenticator, requireAdmin } from '../server/auth.js'
import { serverConfig } from '../server/config.js'
import { LOGIN_FAILURE_MESSAGE } from '../server/admins.js'
import { hashToken } from '../server/sessions.js'
import { adminUsersJson, ownerActor, serverEnv } from './helpers/env.js'

const bearer = (token) => new Request('https://api.test/x', { headers: { authorization: `Bearer ${token}` } })

function sessionDb(row) {
  const queries = []
  const db = {
    query: async (statement, values) => {
      queries.push({ statement, values })
      if (statement.includes('DELETE FROM')) return []
      if (statement.includes('FROM public.admin_sessions') && statement.includes('WHERE token_hash')) {
        return row && row.token_hash === values[0] ? [row] : []
      }
      return []
    },
  }
  return { db, queries }
}

describe('administrator session authentication', () => {
  it('returns null rather than throwing when no token is presented', async () => {
    const { db } = sessionDb()
    const authenticate = createAuthenticator({ db })
    expect(await authenticate(new Request('https://api.test/x'))).toBeNull()
  })

  it('restores a live hashed session as { actorId, username, role: "owner" }', async () => {
    const token = 'live-admin-token'
    const { db, queries } = sessionDb({
      id: 'sess-1',
      administrator_id: ownerActor.actorId,
      username: 'ada',
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
    })
    const authenticate = createAuthenticator({ db, admins: [{ id: ownerActor.actorId, username: 'ada' }] })
    const actor = await authenticate(bearer(token))
    expect(actor).toMatchObject({ actorId: ownerActor.actorId, username: 'ada', role: 'owner' })
    expect(queries.some((entry) => entry.statement.includes('FROM public.admin_sessions'))).toBe(true)
    expect(queries.find((entry) => entry.statement.includes('token_hash')).values[0]).toBe(hashToken(token))
    expect(queries.find((entry) => entry.statement.includes('token_hash')).values[0]).not.toBe(token)
  })

  it('rejects an unknown, expired, or revoked token with the same 401', async () => {
    const { db } = sessionDb()
    const authenticate = createAuthenticator({ db })
    await expect(authenticate(bearer('missing'))).rejects.toMatchObject({ status: 401, code: 'invalid_session' })
  })

  it('requires a database client', () => {
    expect(() => createAuthenticator({})).toThrow(/database client/)
  })
})

describe('administrator authorisation', () => {
  const silentLogger = { info() {}, error() {} }
  const apiRequest = (path, options) => new Request(`https://api.motion.test${path}`, options)

  it('requires a session for management routes', async () => {
    const request = new Request('https://api.test/x')
    await expect(requireAdmin(request, async () => null)).rejects.toMatchObject({ status: 401, code: 'authentication_required' })
  })

  it('refuses a non-owner actor', async () => {
    const request = bearer('t')
    await expect(requireAdmin(request, async () => ({ actorId: 'x', username: 'guest', role: 'customer' })))
      .rejects.toMatchObject({ status: 403, code: 'owner_required' })
  })

  it('admits an owner actor', async () => {
    const request = bearer('t')
    await expect(requireAdmin(request, async () => ownerActor)).resolves.toMatchObject(ownerActor)
  })

  it('refuses an admin route to a customer-shaped actor', async () => {
    const { createApi } = await import('../server/api.js')
    const api = createApi({
      db: { query: async () => [] },
      authenticate: async () => ({ actorId: 'auth-1', username: 'mallory', role: 'customer' }),
      logger: silentLogger,
    })
    const response = await api(apiRequest('/api/admin/products'))
    expect(response.status).toBe(403)
  })

  it('does not create customer profiles or expose /api/me', async () => {
    const { createApi } = await import('../server/api.js')
    const seen = []
    const api = createApi({
      db: { query: async (statement, values) => { seen.push({ statement, values }); return [] } },
      authenticate: async () => null,
      logger: silentLogger,
    })
    const created = await api(apiRequest('/api/me', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fullName: 'Mallory', role: 'admin' }),
    }))
    expect(created.status).toBe(404)
    expect(seen.some((entry) => entry.statement.includes('user_profiles'))).toBe(false)
  })
})

describe('server configuration is validated at startup', () => {
  it('accepts a local DATABASE_URL without administrator credentials outside production', () => {
    expect(() => serverConfig(serverEnv)).not.toThrow()
    const config = serverConfig(serverEnv)
    expect(config.databaseUrl).toBe(serverEnv.DATABASE_URL)
    expect(config.admins).toEqual([])
    expect(config.adminSessionHours).toBe(8)
  })

  it('fails closed in production without ADMIN_USERS_JSON', () => {
    expect(() => serverConfig({ ...serverEnv, NODE_ENV: 'production' }))
      .toThrow(/ADMIN_USERS_JSON/)
  })

  it('accepts a valid administrator list in production when the trusted-client header is set', () => {
    const config = serverConfig({
      ...serverEnv,
      NODE_ENV: 'production',
      ADMIN_USERS_JSON: adminUsersJson(),
      API_TRUSTED_CLIENT_HEADER: 'none',
    })
    expect(config.admins).toHaveLength(1)
    expect(config.admins[0].username).toBe('ada')
  })

  it('requires the restricted role for a production Neon runtime URL', () => {
    const base = {
      ...serverEnv,
      NODE_ENV: 'production',
      ADMIN_USERS_JSON: adminUsersJson(),
      API_TRUSTED_CLIENT_HEADER: 'none',
    }
    expect(() => serverConfig({
      ...base,
      DATABASE_URL: 'postgresql://neondb_owner:secret@ep-example-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    })).toThrow(/motion_app/)
    expect(() => serverConfig({
      ...base,
      DATABASE_URL: 'postgresql://motion_app:secret@ep-example-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    })).not.toThrow()
  })

  it('rejects obsolete Supabase and owner-email variables', () => {
    expect(() => serverConfig({ ...serverEnv, SUPABASE_URL: 'https://example.supabase.co' }))
      .toThrow(/obsolete/)
    expect(() => serverConfig({ ...serverEnv, OWNER_ALLOWED_EMAILS: 'a@b.c' }))
      .toThrow(/obsolete/)
  })
})

describe('login failures stay neutral', () => {
  it('uses one message for every failed administrator login', () => {
    expect(LOGIN_FAILURE_MESSAGE).toMatch(/do not match a Motion staff account/)
    expect(LOGIN_FAILURE_MESSAGE.toLowerCase()).not.toContain('username')
    expect(LOGIN_FAILURE_MESSAGE.toLowerCase()).not.toContain('password')
  })
})
