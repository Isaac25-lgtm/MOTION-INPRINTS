import { ApiError } from './http.js'

/* Verifies Supabase Auth access tokens and decides authorisation.
 *
 * The browser holds a Supabase session and sends `session.access_token` as a
 * bearer token. This process never trusts an email, role or user id from the
 * request body: it asks Supabase Auth to resolve the token (`auth.getUser`)
 * and then loads Motion's own `user_profiles` row for that id.
 *
 * The role is read from our table, never from the token. A Supabase user can
 * carry `app_metadata.role` — that is Supabase's, unrelated to Motion's, and
 * trusting it would let identity-side state decide business authorisation.
 *
 * `getUser` is injectable so tests can exercise the same code path without a
 * live Supabase project. Production always passes a server-side client built
 * with the service_role key.
 */
export function createAuthenticator({ supabase, getUser, db } = {}) {
  const lookup = getUser || (supabase ? (token) => supabase.auth.getUser(token).then(({ data, error }) => {
    if (error || !data?.user) return null
    return data.user
  }) : null)

  if (typeof lookup !== 'function') {
    throw new Error('A Supabase Auth client is required to verify sessions.')
  }
  if (!db) throw new Error('A database client is required to resolve Motion profiles.')

  return async function authenticate(request) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return null
    try {
      const user = await lookup(token)
      if (!user?.id) throw new Error('Missing subject')
      const profiles = await db.query(
        'SELECT id, auth_user_id, role, full_name, phone, company_name FROM public.user_profiles WHERE auth_user_id = $1',
        [user.id],
      )
      return {
        authUserId: user.id,
        profile: profiles[0] || null,
        email: user.email || null,
        emailVerified: Boolean(user.email_confirmed_at),
        user,
      }
    } catch {
      throw new ApiError(401, 'invalid_session', 'Your session is invalid or has expired.')
    }
  }
}

/* Resolves the email address behind a verified session.
 *
 * This is the security hinge of the whole staff flow, so it is worth being
 * explicit about where the address comes from and where it does not.
 *
 *   - NOT from the request body. An email in a payload is a claim by whoever
 *     sent it, and treating one as proof would make the owner allowlist a
 *     public form field.
 *   - NOT from a JWT claim parsed in this process. The token is handed to
 *     Supabase Auth; the user object it returns is the authoritative record.
 *   - FROM `auth.getUser(token)` — email and `email_confirmed_at` — attached
 *     to the actor by `createAuthenticator`.
 *
 * Email confirmation is required, not merely read. Without it, anyone could
 * sign up with an owner's address they do not control and wait to be elevated.
 *
 * Returns null rather than throwing when the identity cannot be resolved, so a
 * caller can render a neutral refusal instead of leaking whether a row exists.
 */
export function resolveVerifiedIdentity(actor) {
  if (!actor?.authUserId) return null
  const email = String(actor.email || actor.user?.email || '').trim().toLowerCase()
  const emailVerified = actor.emailVerified === true
    || Boolean(actor.user?.email_confirmed_at)
  if (!email || !emailVerified) return null
  return { authUserId: actor.authUserId, email, emailVerified: true }
}

/** True only for an address on the server-side allowlist. Empty list approves nobody. */
export function isApprovedOwnerEmail(email, ownerAllowedEmails = []) {
  if (!email) return false
  return ownerAllowedEmails.includes(String(email).trim().toLowerCase())
}

export async function requireAuth(request, authenticate) { const actor = await authenticate(request); if (!actor) throw new ApiError(401, 'authentication_required', 'Sign in is required.'); return actor }
export async function requireCustomer(request, authenticate) { const actor = await requireAuth(request, authenticate); if (!actor.profile) throw new ApiError(403, 'profile_required', 'A customer profile is required.'); return actor }

/* Full management access. The role is read from our table on every request, so
   revoking someone takes effect on their next call rather than when their token
   happens to expire. */
export async function requireOwner(request, authenticate) {
  const actor = await requireAuth(request, authenticate)
  if (actor.profile?.role !== 'owner') throw new ApiError(403, 'owner_required', 'Management access is required.')
  return actor
}

/* Retained so existing call sites keep working while they are migrated. It is a
   strict alias for requireOwner — 'admin' no longer exists as a stored role
   after migration 0013, and having two names for one level of access is how a
   permission check eventually tests the wrong one. */
export const requireAdmin = requireOwner

export function requireOwnership(record, actor, ownerKey = 'customer_id') { if (!record || record[ownerKey] !== actor.profile?.id) throw new ApiError(404, 'not_found', 'Resource not found.'); return record }
