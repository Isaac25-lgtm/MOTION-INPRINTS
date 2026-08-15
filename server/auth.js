import { createRemoteJWKSet, jwtVerify } from 'jose'
import { ApiError } from './http.js'

/* Verifies Neon Auth (Managed Better Auth) tokens.
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
 *      For `https://ep-x.neonauth.../neondb/auth` the issuer is
 *      `https://ep-x.neonauth...` with no path. Deriving it by trimming the path
 *      is a guess, so it is configured explicitly and validated at startup.
 *
 *   3. `createRemoteJWKSet` caches keys and refetches on unknown `kid`, so key
 *      rotation needs no redeploy. It is created once per process, not per
 *      request — a per-request set would refetch the JWKS on every call.
 *
 * The role is read from our own `user_profiles` table, never from the token. A
 * Neon Auth user object carries its own `role` field, which is Better Auth's and
 * has nothing to do with Motion's. Trusting that would let identity-side state
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
      const { payload } = await jwtVerify(token, keys, {
        issuer,
        algorithms: ['EdDSA'],
      })
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

export async function requireAuth(request, authenticate) { const actor = await authenticate(request); if (!actor) throw new ApiError(401, 'authentication_required', 'Sign in is required.'); return actor }
export async function requireCustomer(request, authenticate) { const actor = await requireAuth(request, authenticate); if (!actor.profile) throw new ApiError(403, 'profile_required', 'A customer profile is required.'); return actor }
export async function requireAdmin(request, authenticate) { const actor = await requireAuth(request, authenticate); if (actor.profile?.role !== 'admin') throw new ApiError(403, 'admin_required', 'Administrator access is required.'); return actor }
export function requireOwnership(record, actor, ownerKey = 'customer_id') { if (!record || record[ownerKey] !== actor.profile?.id) throw new ApiError(404, 'not_found', 'Resource not found.'); return record }
