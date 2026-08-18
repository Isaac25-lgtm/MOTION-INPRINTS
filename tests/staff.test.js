import { describe, expect, it } from 'vitest'
import { createApi } from '../server/api.js'
import { isApprovedOwnerEmail, requireOwner, resolveVerifiedIdentity } from '../server/auth.js'
import { serverConfig } from '../server/config.js'

/* Owner authorisation.
 *
 * Two named people may reach the dashboard. Everything here exists to prove that
 * the browser cannot influence who they are.
 *
 * The identity is resolved server-side from `neon_auth.user` using the verified
 * token subject — an audit of that table confirmed it carries `id`, `email` and
 * `emailVerified`. No email is read from a request body, and none from a token
 * claim.
 */

const silent = { info() {}, error() {} }
const req = (path, options) => new Request(`https://api.motion.test${path}`, options)
const body = async (response) => ({ status: response.status, ...(await response.json()) })

const OWNERS = ['owner-one@example.com', 'owner-two@example.com']

/** A database double answering the queries the bootstrap makes. */
function fakeDb({ identity = null, profile = null } = {}) {
  const writes = []
  return {
    writes,
    query: async (statement, values = []) => {
      if (statement.includes('neon_auth."user"')) return identity ? [identity] : []
      if (statement.includes('FROM public.user_profiles WHERE auth_user_id')) return profile ? [profile] : []
      if (statement.includes('INSERT INTO public.user_profiles')) {
        writes.push({ statement, values })
        return [{ id: 'profile-1', auth_user_id: values[0], role: 'owner', full_name: values[1], phone: null, company_name: null }]
      }
      if (statement.includes('admin_audit_log')) { writes.push({ statement, values }); return [] }
      return []
    },
  }
}

const authAs = (authUserId, profile = null) => async () => ({ authUserId, profile, claims: { sub: authUserId } })

const bootstrap = (db, authenticate, owners = OWNERS) =>
  createApi({ db, authenticate, logger: silent, ownerAllowedEmails: owners })(
    req('/api/staff/bootstrap', { method: 'POST' }),
  )

const insertsIn = (db) => db.writes.filter(w => w.statement.includes('INSERT INTO public.user_profiles'))

describe('verified identity resolution', () => {
  it('reads the email from neon_auth.user, never from the caller', async () => {
    const db = fakeDb({ identity: { id: 'u1', email: 'Owner-One@Example.com', email_verified: true } })
    const identity = await resolveVerifiedIdentity(db, 'u1')
    // Normalised, so an allowlist comparison is not defeated by casing.
    expect(identity.email).toBe('owner-one@example.com')
  })

  /* Without this, anyone could register an address they do not control and wait
     to be elevated. */
  it('refuses an unverified address', async () => {
    const db = fakeDb({ identity: { id: 'u1', email: 'owner-one@example.com', email_verified: false } })
    expect(await resolveVerifiedIdentity(db, 'u1')).toBeNull()
  })

  it('refuses an identity that does not exist', async () => {
    expect(await resolveVerifiedIdentity(fakeDb(), 'nobody')).toBeNull()
    expect(await resolveVerifiedIdentity(fakeDb(), null)).toBeNull()
  })

  it('approves only exact allowlist members, and nobody when the list is empty', () => {
    expect(isApprovedOwnerEmail('owner-one@example.com', OWNERS)).toBe(true)
    expect(isApprovedOwnerEmail('OWNER-TWO@EXAMPLE.COM', OWNERS)).toBe(true)
    expect(isApprovedOwnerEmail('someone@example.com', OWNERS)).toBe(false)
    // Fails closed: an unset variable approves nobody rather than everybody.
    expect(isApprovedOwnerEmail('owner-one@example.com', [])).toBe(false)
    expect(isApprovedOwnerEmail('', OWNERS)).toBe(false)
  })
})

describe('staff bootstrap', () => {
  it('provisions exactly one owner profile for the first approved sign-in', async () => {
    const db = fakeDb({ identity: { id: 'u1', email: 'owner-one@example.com', email_verified: true } })
    const result = await body(await bootstrap(db, authAs('u1')))

    expect(result.status).toBe(200)
    expect(result.data.owner).toBe(true)
    expect(result.data.profile.role).toBe('owner')

    expect(insertsIn(db)).toHaveLength(1)
    // An upsert, so a repeat cannot create a second row.
    expect(insertsIn(db)[0].statement).toContain('ON CONFLICT (auth_user_id) DO UPDATE')
  })

  it('behaves identically for the second approved owner', async () => {
    const db = fakeDb({ identity: { id: 'u2', email: 'owner-two@example.com', email_verified: true } })
    const result = await body(await bootstrap(db, authAs('u2')))
    expect(result.status).toBe(200)
    expect(result.data.profile.role).toBe('owner')
  })

  it('is idempotent — repeated sign-ins never duplicate a profile', async () => {
    const identity = { id: 'u1', email: 'owner-one@example.com', email_verified: true }
    const existing = { id: 'profile-1', auth_user_id: 'u1', role: 'owner' }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const db = fakeDb({ identity, profile: existing })
      const result = await body(await bootstrap(db, authAs('u1', existing)))
      expect(result.status).toBe(200)
      expect(insertsIn(db)).toHaveLength(1)
    }
  })

  it('upgrades an existing customer profile in place rather than creating a second', async () => {
    const customer = { id: 'profile-1', auth_user_id: 'u1', role: 'customer', full_name: 'Amina' }
    const db = fakeDb({ identity: { id: 'u1', email: 'owner-one@example.com', email_verified: true }, profile: customer })
    const result = await body(await bootstrap(db, authAs('u1', customer)))

    expect(result.status).toBe(200)
    expect(result.data.profile.role).toBe('owner')
    // COALESCE keeps the name they already gave us.
    expect(insertsIn(db)[0].statement).toContain('COALESCE')
    expect(db.writes.some(w => w.statement.includes('admin_audit_log'))).toBe(true)
  })

  it('refuses an unapproved identity neutrally, creating and elevating nothing', async () => {
    const db = fakeDb({ identity: { id: 'u9', email: 'stranger@example.com', email_verified: true } })
    const result = await body(await bootstrap(db, authAs('u9')))

    expect(result.status).toBe(403)
    expect(result.error.code).toBe('not_authorised_for_staff')
    // The refusal says nothing about whether the address exists or is verified.
    expect(result.error.message).not.toMatch(/verif|exist|unknown|allow/i)
    expect(insertsIn(db)).toHaveLength(0)
  })

  it('refuses an approved address that has not been verified', async () => {
    const db = fakeDb({ identity: { id: 'u1', email: 'owner-one@example.com', email_verified: false } })
    expect((await body(await bootstrap(db, authAs('u1')))).status).toBe(403)
    expect(insertsIn(db)).toHaveLength(0)
  })

  it('refuses an anonymous caller', async () => {
    const db = fakeDb({ identity: { id: 'u1', email: 'owner-one@example.com', email_verified: true } })
    expect((await body(await bootstrap(db, async () => null))).status).toBe(401)
  })

  /* The obvious attack: send an owner address in the body and hope it is
     trusted. It must be ignored entirely. */
  it('ignores an email supplied in the request body', async () => {
    const db = fakeDb({ identity: { id: 'u9', email: 'stranger@example.com', email_verified: true } })
    const response = await createApi({ db, authenticate: authAs('u9'), logger: silent, ownerAllowedEmails: OWNERS })(
      req('/api/staff/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner-one@example.com', role: 'owner', isOwner: true }),
      }),
    )
    expect((await body(response)).status).toBe(403)
    expect(insertsIn(db)).toHaveLength(0)
  })
})

describe('owner-only APIs', () => {
  const ownerRequest = req('/api/admin/products')

  it('admits an owner and rejects a customer and an anonymous caller', async () => {
    await expect(requireOwner(ownerRequest, authAs('u1', { id: 'p', role: 'owner' }))).resolves.toBeTruthy()
    await expect(requireOwner(ownerRequest, authAs('u2', { id: 'p', role: 'customer' })))
      .rejects.toMatchObject({ status: 403, code: 'owner_required' })
    await expect(requireOwner(ownerRequest, async () => null)).rejects.toMatchObject({ status: 401 })
  })

  it('rejects a customer at the admin route itself', async () => {
    const api = createApi({ db: fakeDb(), authenticate: authAs('u2', { id: 'p', role: 'customer' }), logger: silent })
    expect((await api(req('/api/admin/products'))).status).toBe(403)
  })

  /* A stale 'admin' row must not keep access that migration 0013 converts. */
  it('does not treat a legacy admin role as an owner', async () => {
    await expect(requireOwner(ownerRequest, authAs('u3', { id: 'p', role: 'admin' })))
      .rejects.toMatchObject({ status: 403 })
  })
})

describe('owner allowlist configuration', () => {
  const base = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    NEON_AUTH_JWKS_URL: 'https://ep-test.neonauth.example.aws.neon.tech/neondb/auth/.well-known/jwks.json',
    NEON_AUTH_ISSUER: 'https://ep-test.neonauth.example.aws.neon.tech',
  }

  it('parses, trims and lowercases the list', () => {
    const config = serverConfig({ ...base, OWNER_ALLOWED_EMAILS: ' Owner-One@Example.com , owner-two@example.com ' })
    expect(config.ownerAllowedEmails).toEqual(['owner-one@example.com', 'owner-two@example.com'])
  })

  it('is empty when unset, so no identity is approved', () => {
    expect(serverConfig(base).ownerAllowedEmails).toEqual([])
  })

  it('is never exposed under a VITE_ name anywhere in the browser bundle', async () => {
    const { readFile, readdir } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const root = fileURLToPath(new URL('../src/', import.meta.url))
    const walk = async (dir, files = []) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) await walk(path, files)
        else if (/\.(jsx?|css)$/.test(entry.name)) files.push(path)
      }
      return files
    }
    for (const file of await walk(root)) {
      const source = await readFile(file, 'utf8')
      expect(source, `${file} must not reference the owner allowlist`).not.toContain('OWNER_ALLOWED_EMAILS')
    }
  })
})
