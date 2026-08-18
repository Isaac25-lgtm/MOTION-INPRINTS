import { createRemoteJWKSet, jwtVerify } from 'jose'
import { ApiError } from './http.js'

/* Verifies Neon Auth (Managed Better Auth) tokens and decides authorisation.
 *
 * The browser holds an HTTP-only session cookie belonging to the Neon Auth
 * origin. That cookie is not sent to us and would prove nothing if it were, so
 * the client exchanges it for a short-lived JWT and sends that as a bearer
 * token. This verifies the signature against Neon's published JWKS.
 *
 * Three details that are easy to get wrong, all confirmed against the live
 * project rather than assumed:
 *
 *   1. **Algorithm is EdDSA (Ed25519)**, not RS256. The JWKS serves a single
 *      OKP/Ed25519 key. `algorithms` is pinned so a token cannot arrive claiming
 *      a weaker algorithm and be accepted on the strength of its own header.
 *
 *   2. **The issuer is the ORIGIN of the auth URL, not the auth URL itself.**
 *      Deriving it by trimming the path is a guess, so it is configured
 *      explicitly and validated at startup.
 *
 *   3. `createRemoteJWKSet` caches keys and refetches on unknown `kid`, so key
 *      rotation needs no redeploy. It is created once per process.
 *
 * The role is read from our own `user_profiles` table, never from the token. A
 * Neon Auth user object carries its own `role` column, which is Better Auth's
 * and has nothing to do with Motion's. Trusting it would let identity-side state
 * decide business authorisation.
 */
export function createAuthenticator({ jwksUrl, issuer, db }) {
  if (!jwksUrl) throw new Error('NEON_AUTH_JWKS_URL is required to verify sessions.')
  if (!issuer) throw new Error('NEON_AUTH_ISSUER is required to verify sessions.')

  const keys = createRemoteJWKSet(new URL(jwksUrl))

  return async function authenticate(request) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return null
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, algorithms: ['EdDSA'] })
      if (!payload.sub) throw new Error('Missing subject')
      const profiles = await db.query(
        'SELECT id, auth_user_id, role, full_name, phone, company_name FROM public.user_profiles WHERE auth_user_id = $1',
        [payload.sub],
      )
      return { authUserId: payload.sub, profile: profiles[0] || null, claims: payload }
    } catch {
      throw new ApiError(401, 'invalid_session', 'Your session is invalid or has expired.')
    }
  }
}

/* Resolves the email address behind a verified session, from the database.
 *
 * This is the security hinge of the whole staff flow, so it is worth being
 * explicit about where the address comes from and where it does not.
 *
 *   - NOT from the request body. An email in a payload is a claim by whoever
 *     sent it, and treating one as proof would make the owner allowlist a
 *     public form field.
 *   - NOT from the JWT. Neon's token is not documented to carry a stable email
 *     claim, and building authorisation on an undocumented claim means a silent
 *     failure the day the token shape changes. The audit of `neon_auth.user`
 *     found `id`, `email` and `emailVerified`, which is a better source anyway.
 *   - FROM `neon_auth.user`, keyed on the `sub` of a cryptographically verified
 *     token. That is Neon Auth's own authoritative record, in the same database,
 *     written by the identity provider rather than by any caller.
 *
 * `emailVerified` is required, not merely read. Without it, anyone could sign up
 * with an owner's address they do not control and wait to be elevated. With
 * email verification enabled on the project a password signup cannot reach a
 * session unverified, but that is a setting someone could later switch off — so
 * the check lives here, where it cannot be turned off by accident.
 *
 * Returns null rather than throwing when the identity cannot be resolved, so a
 * caller can render a neutral refusal instead of leaking whether a row exists.
 */
export async function resolveVerifiedIdentity(db, authUserId) {
  if (!authUserId) return null
  const rows = await db.query(
    'SELECT id, email, "emailVerified" AS email_verified FROM neon_auth."user" WHERE id = $1',
    [authUserId],
  )
  const identity = rows[0]
  if (!identity?.email || !identity.email_verified) return null
  return { authUserId, email: String(identity.email).trim().toLowerCase(), emailVerified: true }
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
