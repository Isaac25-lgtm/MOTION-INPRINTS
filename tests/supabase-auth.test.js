import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createApi } from '../server/api.js'
import { createAuthenticator, resolveVerifiedIdentity } from '../server/auth.js'

const silent = { info() {}, error() {} }
const req = (path, options) => new Request(`https://api.motion.test${path}`, options)
const authSource = () => readFile(fileURLToPath(new URL('../src/auth/authClient.js', import.meta.url)), 'utf8')

function loadSafeInternalPath(source) {
  const start = source.indexOf('export function safeInternalPath')
  const end = source.indexOf('const looksLikeJwt')
  return new Function(`${source.slice(start, end).replace('export ', '')}; return safeInternalPath`)()
}

describe('Supabase email/password and Google client contracts', () => {
  it('signs up and in with email/password through supabase-js', async () => {
    const source = await authSource()
    expect(source).toContain('c.auth.signUp')
    expect(source).toContain('c.auth.signInWithPassword')
    expect(source).toContain('c.auth.signInWithOAuth')
    expect(source).toContain("provider: 'google'")
    expect(source).toContain('client.auth.resetPasswordForEmail')
    expect(source).toContain('c.auth.updateUser')
    expect(source).toContain("type: 'signup'")
    expect(source).toContain('detectSessionInUrl: true')
    expect(source).toContain("flowType: 'pkce'")
  })

  it('sanitises Google and reset redirects to same-site paths', async () => {
    const safeInternalPath = loadSafeInternalPath(await authSource())
    expect(safeInternalPath('/manager')).toBe('/manager')
    expect(safeInternalPath('/account/profile')).toBe('/account/profile')
    expect(safeInternalPath('https://evil.test/phish')).toBe('/')
    expect(safeInternalPath('//evil.test')).toBe('/')
    expect(safeInternalPath('/\\evil')).toBe('/')
  })

  it('restores Google by reading the session rather than exchanging a code in app code', async () => {
    const provider = await readFile(fileURLToPath(new URL('../src/auth/AuthProvider.jsx', import.meta.url)), 'utf8')
    expect(provider).toContain('authClient.getSession()')
    expect(provider).toContain('SIGNED_IN')
    expect(provider).toContain('onAuthStateChange')
  })
})

describe('API bearer tokens are resolved server-side', () => {
  it('passes the bearer token to getUser and refuses an anonymous /api/me', async () => {
    const seen = []
    const db = { query: async () => [] }
    const authenticate = createAuthenticator({
      db,
      getUser: async (token) => {
        seen.push(token)
        return null
      },
    })
    const api = createApi({ db, authenticate, logger: silent })

    const denied = await api(req('/api/me'))
    expect(denied.status).toBe(401)

    const invalid = await api(req('/api/me', { headers: { authorization: 'Bearer not-a-user' } }))
    expect(invalid.status).toBe(401)
    expect(seen).toContain('not-a-user')
  })

  it('bootstraps a verified allowlisted owner and refuses others', async () => {
    const writes = []
    const db = {
      query: async (statement, values = []) => {
        if (statement.includes('INSERT INTO public.user_profiles')) {
          writes.push(values)
          return [{ id: 'p1', auth_user_id: values[0], role: 'owner', full_name: values[1] }]
        }
        if (statement.includes('admin_audit_log')) return []
        return []
      },
    }
    const ownerUser = {
      id: 'owner-1',
      email: 'owner-one@example.com',
      email_confirmed_at: '2026-01-01T00:00:00Z',
    }
    const authenticate = createAuthenticator({
      db,
      getUser: async (token) => {
        if (token === 'owner-token') return ownerUser
        if (token === 'unverified-token') return { ...ownerUser, id: 'u2', email_confirmed_at: null }
        if (token === 'stranger-token') return { id: 'u3', email: 'stranger@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }
        return null
      },
    })
    const api = createApi({
      db,
      authenticate,
      logger: silent,
      ownerAllowedEmails: ['owner-one@example.com', 'owner-two@example.com'],
    })

    const ok = await api(req('/api/staff/bootstrap', { method: 'POST', headers: { authorization: 'Bearer owner-token' } }))
    expect(ok.status).toBe(200)
    expect(writes).toHaveLength(1)

    const unverified = await api(req('/api/staff/bootstrap', { method: 'POST', headers: { authorization: 'Bearer unverified-token' } }))
    expect(unverified.status).toBe(403)

    const stranger = await api(req('/api/staff/bootstrap', { method: 'POST', headers: { authorization: 'Bearer stranger-token' } }))
    expect(stranger.status).toBe(403)
  })

  it('does not treat an email on the Auth user as verified without email_confirmed_at', () => {
    expect(resolveVerifiedIdentity({
      authUserId: 'u1',
      email: 'owner-one@example.com',
      emailVerified: false,
      user: { email: 'owner-one@example.com', email_confirmed_at: null },
    })).toBeNull()
  })
})

describe('operator docs match the Supabase runtime', () => {
  it('does not tell operators that AuthProvider is a hardcoded anonymous session', async () => {
    const audit = await readFile(fileURLToPath(new URL('../GO_LIVE_AUDIT.md', import.meta.url)), 'utf8')
    expect(audit).not.toMatch(/returns a hardcoded anonymous session/i)
    expect(audit).not.toMatch(/Neon Auth is not connected/i)
    expect(audit).toMatch(/supabase\.auth\.getUser/)
    expect(audit).toMatch(/Do not re-run the bootstrap SQL/)
  })
})
