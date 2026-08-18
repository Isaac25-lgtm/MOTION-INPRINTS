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

describe('exactly two owners, or nobody', () => {
  const base = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    NEON_AUTH_JWKS_URL: 'https://ep-test.neonauth.example.aws.neon.tech/neondb/auth/.well-known/jwks.json',
    NEON_AUTH_ISSUER: 'https://ep-test.neonauth.example.aws.neon.tech',
  }
  const config = (value) => serverConfig({ ...base, ...(value === undefined ? {} : { OWNER_ALLOWED_EMAILS: value }) })

  it('accepts exactly two well-formed addresses, normalised', () => {
    const c = config(' Owner-One@Example.com , owner-two@example.com ')
    expect(c.ownersConfigured).toBe(true)
    expect(c.ownerAllowedEmails).toEqual(['owner-one@example.com', 'owner-two@example.com'])
  })

  /* Every malformed shape resolves to an EMPTY list. A half-configured allowlist
     must never mean "approve whoever is left".

     Validation runs on the RAW supplied list, before any deduplication. Doing it
     the other way round was a real hole: three entries containing two unique
     addresses collapsed to two and were accepted, so a list that plainly did not
     name two owners passed silently. */
  it('approves nobody when the list is not exactly two valid addresses', () => {
    for (const value of [
      undefined,                                    // unset
      '',                                           // blank
      'owner-one@example.com',                      // only one
      'a@x.com,b@y.com,c@z.com',                    // three distinct
      'owner-one@example.com,not-an-email',         // malformed
      'owner-one@example.com,@example.com',         // malformed
    ]) {
      const c = config(value)
      expect(c.ownersConfigured, `"${value}" must not count as configured`).toBe(false)
      expect(c.ownerAllowedEmails).toEqual([])
    }
  })

  /* Duplicates specifically, because deduplicating before counting is the exact
     mistake that let a three-entry list through. */
  it('refuses any duplicate, however it is written', () => {
    const duplicates = {
      'the same address twice': 'owner1@email.com,owner1@email.com',
      'the same twice plus a second': 'owner1@email.com,owner1@email.com,owner2@email.com',
      'the same in different case': 'Owner1@Email.com,owner1@email.com',
      'the same with surrounding whitespace': ' owner1@email.com , owner1@email.com ',
      'the same in case and spacing, plus a second': ' Owner1@Email.com ,owner1@email.com, owner2@email.com',
    }
    for (const [description, value] of Object.entries(duplicates)) {
      const c = config(value)
      expect(c.ownersConfigured, `${description} must not be configured`).toBe(false)
      expect(c.ownerAllowedEmails, `${description} must approve nobody`).toEqual([])
    }
  })

  it('accepts exactly two distinct valid addresses and nothing else', () => {
    const c = config('owner1@email.com,owner2@email.com')
    expect(c.ownersConfigured).toBe(true)
    expect(c.ownerAllowedEmails).toEqual(['owner1@email.com', 'owner2@email.com'])
  })

  /* A stray comma is a typo, not a third owner. Blanks are dropped before the
     count, so two real addresses still configure — failing closed here would
     lock both owners out over a punctuation slip. */
  it('tolerates an empty entry from a stray comma', () => {
    for (const value of ['a@x.com,,b@y.com', 'a@x.com,b@y.com,', ',a@x.com,b@y.com']) {
      const c = config(value)
      expect(c.ownersConfigured, `"${value}" is still two owners`).toBe(true)
      expect(c.ownerAllowedEmails).toEqual(['a@x.com', 'b@y.com'])
    }
  })

  /* Staff configuration is not a reason to stop a customer buying. */
  it('never throws, so the public API keeps serving guests', () => {
    expect(() => config('nonsense')).not.toThrow()
    expect(() => config(undefined)).not.toThrow()
    const api = createApi({ db: fakeDb(), authenticate: async () => null, logger: silent, ownerAllowedEmails: [], ownersConfigured: false })
    return expect(api(req('/api/products'))).resolves.toMatchObject({ status: 200 })
  })

  it('reports the problem only on the staff route, and only neutrally', async () => {
    const db = fakeDb({ identity: { id: 'u1', email: 'owner-one@example.com', email_verified: true } })
    const api = createApi({ db, authenticate: authAs('u1'), logger: silent, ownerAllowedEmails: [], ownersConfigured: false })
    const result = await body(await api(req('/api/staff/bootstrap', { method: 'POST' })))

    expect(result.status).toBe(503)
    expect(result.error.code).toBe('staff_configuration_unavailable')
    // Says nothing about which addresses are approved, or that any exist.
    expect(result.error.message).not.toMatch(/owner|allow|email|@/i)
    expect(insertsIn(db)).toHaveLength(0)
  })
})

describe('setting a password for an existing Google-only owner', () => {
  const page = async () => {
    const { readFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    return readFile(fileURLToPath(new URL('../src/pages/ManagerActivatePage.jsx', import.meta.url)), 'utf8')
  }
  const code = async () => (await page())
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/role="[a-z]+"/g, '')

  /* The decisive property. Sign-up would have produced a SECOND account for a
     person who already has one, splitting their identity, orders and access. */
  it('uses the reset flow on the existing identity, never a second account', async () => {
    const source = await code()
    expect(source).toContain('authClient.requestPasswordReset')
    expect(source, 'must not create another account').not.toContain('authClient.signUp')
    expect(source).not.toMatch(/signUp/)
  })

  it('returns the owner to /manager after the password is set', async () => {
    const source = await code()
    const call = source.slice(source.indexOf('authClient.requestPasswordReset'))
    expect(call).toMatch(/next:\s*'\/manager'/)
    expect(call.slice(0, 120)).not.toContain('/account')
  })

  it('grants nothing and sends no role', async () => {
    const source = await code()
    for (const forbidden of ['role', 'isOwner', 'staffService', 'bootstrap']) {
      expect(source, `must not send ${forbidden}`).not.toMatch(new RegExp(`\b${forbidden}\b`, 'i'))
    }
  })

  it('cannot reveal whether an address exists or is approved', async () => {
    const source = await code()
    expect(source).not.toContain('OWNER_ALLOWED_EMAILS')
    // The confirmation is hedged, so it is not a check for registered addresses.
    expect(source).toMatch(/If .*belongs to a Motion account/)
    expect(source).not.toMatch(/(approved|allowlist|not authorised|no such account)/i)
  })

  it('keeps Google working and optional', async () => {
    const source = await page()
    expect(source.replace(/\s+/g, ' ')).toMatch(/Google\s*sign-in keeps working/i)
    const manager = await (async () => {
      const { readFile } = await import('node:fs/promises')
      const { fileURLToPath } = await import('node:url')
      return readFile(fileURLToPath(new URL('../src/pages/ManagerSignInPage.jsx', import.meta.url)), 'utf8')
    })()
    // Google is still offered, and still behind the enabled flag.
    expect(manager).toContain('googleEnabled &&')
    expect(manager).toContain('signInWithGoogle')
  })

  it('is routed but never linked from anywhere public', async () => {
    const { readFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const app = await readFile(fileURLToPath(new URL('../src/App.jsx', import.meta.url)), 'utf8')
    expect(app).toContain('path="/manager/activate"')

    for (const file of ['../src/layouts/SiteHeader.jsx', '../src/layouts/SiteFooter.jsx', '../src/pages/account/AccountPages.jsx']) {
      const source = await readFile(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
      expect(source, `${file} must not link staff activation`).not.toMatch(/manager\/activate/)
    }
  })

  /* Only the server may grant the role, wherever the password came from. */
  it('leaves the bootstrap as the sole grant path', async () => {
    const db = fakeDb({ identity: { id: 'new-user', email: 'stranger@example.com', email_verified: true } })
    const result = await body(await bootstrap(db, authAs('new-user')))
    expect(result.status).toBe(403)
    expect(insertsIn(db)).toHaveLength(0)
  })

  /* A reset link that could redirect anywhere would let anyone mail a
     "reset your password" link landing on a site they control. */
  it('honours only same-site return paths', async () => {
    const { readFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const auth = await readFile(fileURLToPath(new URL('../src/pages/AuthPages.jsx', import.meta.url)), 'utf8')
    const guard = auth.slice(auth.indexOf('const requestedNext'), auth.indexOf('const invalidLink'))
    expect(guard).toMatch(/startsWith\('\/'\)/)
    expect(guard, 'protocol-relative URLs must be rejected').toMatch(/startsWith\('\/\/'\)/)
  })
})

describe('staff email-verification recovery', () => {
  const readSource = async (file) => {
    const { readFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    return readFile(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
  }
  const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  /* A staff member who cannot confirm their address has no way forward without
     this. Both pages told them a link had been sent and then offered nothing. */
  it('offers a resend on the password-setup page, returning to /manager', async () => {
    const source = strip(await readSource('../src/pages/ManagerActivatePage.jsx'))
    expect(source).toContain('Send the link again')
    expect(source).toContain('authClient.requestPasswordReset')

    const call = source.slice(source.indexOf('authClient.requestPasswordReset'))
    expect(call, 'resend must return to the staff flow').toMatch(/next:\s*'\/manager'/)
    expect(call, 'resend must reuse the address just entered').toMatch(/email:\s*(sent|email)/)
    // Never the customer sign-in page.
    expect(call.slice(0, 140)).not.toContain('/sign-in')
  })

  it('offers a resend on the staff sign-in page when the address is unconfirmed', async () => {
    const source = strip(await readSource('../src/pages/ManagerSignInPage.jsx'))
    expect(source).toContain('email_not_verified')
    expect(source).toContain('Send the link again')

    const call = source.slice(source.indexOf('authClient.resendVerification'))
    expect(call).toMatch(/next:\s*'\/manager'/)
    // The address is the one just typed into the form.
    expect(source).toMatch(/setUnverified\(form\.email\)/)
    expect(call).toMatch(/email:\s*unverified/)
  })

  /* The confirmation must not become an oracle for which addresses exist, are
     already verified, or belong to an owner. */
  it('keeps both confirmations neutral', async () => {
    for (const file of ['../src/pages/ManagerActivatePage.jsx', '../src/pages/ManagerSignInPage.jsx']) {
      const source = strip(await readSource(file))
      expect(source, `${file} must hedge the confirmation`)
        .toMatch(/If that address (still needs confirming|belongs to a Motion account)/)
      expect(source).not.toMatch(/(owner|approved|staff account exists|we found)/i)
    }
  })

  /* The whole flow assumes a link. If the project issues codes there is no field
     to type one into, so the pages must say so rather than claim a link. */
  it('reports a configuration mismatch instead of pretending a link was sent', async () => {
    for (const file of ['../src/pages/ManagerActivatePage.jsx', '../src/pages/ManagerSignInPage.jsx']) {
      const source = strip(await readSource(file))
      expect(source, `${file} must handle code mode`).toMatch(/verificationMethod === 'code'/)
      expect(source).toMatch(/VITE_NEON_AUTH_VERIFICATION/)
    }

    const env = await readSource('../src/config/env.js')
    // Declared, because a console setting cannot be read from the browser.
    expect(env).toMatch(/authVerificationMethod/)
    expect(env, 'link is the expected default').toMatch(/=== 'code' \? 'code' : 'link'/)
  })

  it('lets the caller choose where the emailed link returns to', async () => {
    const client = strip(await readSource('../src/auth/authClient.js'))
    const fn = client.slice(client.indexOf('async resendVerification'))
    expect(fn).toMatch(/next = '\/sign-in\?verified=1'/)   // customer default
    expect(fn).toMatch(/callbackURL: `\$\{origin\(\)\}\$\{next\}`/)
  })
})
