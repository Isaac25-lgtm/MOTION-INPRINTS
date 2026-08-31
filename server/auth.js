import { ApiError } from './http.js'
import { restoreSession } from './sessions.js'

/* Verifies administrator bearer tokens against hashed rows in PostgreSQL.
 *
 * Customers never authenticate. A missing Authorization header is anonymous.
 * A present token that does not match a live administrator session is 401.
 * The actor shape is { actorId, username, role: "owner" }. */

export function createAuthenticator({ db, admins = null } = {}) {
  if (!db) throw new Error('A database client is required to verify administrator sessions.')

  return async function authenticate(request) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
    if (!token) return null
    try {
      return await restoreSession(db, token, { admins })
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(401, 'invalid_session', 'Your session is invalid or has expired.')
    }
  }
}

export function readBearerToken(request) {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null
}

export async function requireAdmin(request, authenticate) {
  const actor = await authenticate(request)
  if (!actor) throw new ApiError(401, 'authentication_required', 'Sign in is required.')
  if (actor.role !== 'owner') throw new ApiError(403, 'owner_required', 'Management access is required.')
  return actor
}

/* Guest order access: reference identifies, token authorises. Prefer body or
   Authorization for mutations so the credential is not written into access logs.
   GET tracking still accepts ?token= for the confirmation link. */
export function readGuestToken(request, { url, body } = {}) {
  const fromBody = body?.token || body?.trackingToken
  if (fromBody) return String(fromBody)
  const fromHeader = readBearerToken(request)
  if (fromHeader) return fromHeader
  const fromQuery = url?.searchParams?.get('token')
  return fromQuery ? String(fromQuery) : null
}
