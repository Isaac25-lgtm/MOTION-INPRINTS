import { createRemoteJWKSet, jwtVerify } from 'jose'
import { ApiError } from './http.js'
export function createAuthenticator({ jwksUrl, issuer, db }) {
  const keys = createRemoteJWKSet(new URL(jwksUrl))
  return async function authenticate(request) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return null
    try {
      const { payload } = await jwtVerify(token, keys, { issuer })
      if (!payload.sub) throw new Error('Missing subject')
      const profiles = await db.query('SELECT id, auth_user_id, role, full_name, phone, company_name FROM public.user_profiles WHERE auth_user_id = $1', [payload.sub])
      return { authUserId: payload.sub, profile: profiles[0] || null, claims: payload }
    } catch { throw new ApiError(401, 'invalid_session', 'Your session is invalid or has expired.') }
  }
}
export async function requireAuth(request, authenticate) { const actor = await authenticate(request); if (!actor) throw new ApiError(401, 'authentication_required', 'Sign in is required.'); return actor }
export async function requireCustomer(request, authenticate) { const actor = await requireAuth(request, authenticate); if (!actor.profile) throw new ApiError(403, 'profile_required', 'A customer profile is required.'); return actor }
export async function requireAdmin(request, authenticate) { const actor = await requireAuth(request, authenticate); if (actor.profile?.role !== 'admin') throw new ApiError(403, 'admin_required', 'Administrator access is required.'); return actor }
export function requireOwnership(record, actor, ownerKey = 'customer_id') { if (!record || record[ownerKey] !== actor.profile?.id) throw new ApiError(404, 'not_found', 'Resource not found.'); return record }
