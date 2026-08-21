import { env } from '../config/env'
export class ApiClientError extends Error { constructor(message, { status, code, details } = {}) { super(message); this.name = 'ApiClientError'; this.status = status; this.code = code; this.details = details } }
function endpoint(path) { return `${env.apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}` }
/* The session supplies the bearer token through this hook rather than every call
   site passing one. Reading it at call time means a token minted mid-session is
   picked up without re-wiring anything.

   The provider is asynchronous: Supabase Auth yields a short-lived access
   token from the restored session. It was previously a synchronous read
   of a token held in memory, and leaving it as a default parameter would have
   put a *Promise* in the Authorization header — a promise is truthy, so this
   would have failed as `Bearer [object Promise]` rather than as a missing
   token. It is awaited explicitly below. */
let authTokenProvider = async () => null
export function setAuthTokenProvider(provider) { authTokenProvider = provider || (async () => null) }

export async function request(path, { method = 'GET', body, signal, headers = {}, token } = {}) {
  /* `undefined` means "ask the session"; an explicit value — including null — is
     honoured, so a call site can deliberately send an unauthenticated request. */
  const bearer = token === undefined ? await authTokenProvider() : token
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 10000)
  const relayAbort = () => controller.abort(); signal?.addEventListener('abort', relayAbort, { once: true })
  try {
    const response = await fetch(endpoint(path), { method, signal: controller.signal, headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new ApiClientError(payload?.error?.message || 'Request failed.', { status: response.status, code: payload?.error?.code, details: payload?.error?.details })
    return payload.data
  } finally { window.clearTimeout(timer); signal?.removeEventListener('abort', relayAbort) }
}
