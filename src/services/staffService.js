import { request } from './apiClient'

/* Staff access.
 *
 * `bootstrap` sends no arguments at all, and that is the point. The server
 * resolves who the caller is from the verified session and checks that identity
 * against a server-only allowlist. There is nothing useful to send: an email, a
 * role or an "is owner" flag in the body would be ignored, and the endpoint is
 * written so that it must be.
 *
 * Returns `{ owner: true, profile }` for an approved identity, or throws a 403
 * whose message is identical for every kind of refusal.
 */
export const staffService = {
  bootstrap: (options) => request('/staff/bootstrap', { ...options, method: 'POST' }),
}
