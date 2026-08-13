import { env } from '../config/env'
export class ApiClientError extends Error { constructor(message, { status, code, details } = {}) { super(message); this.name = 'ApiClientError'; this.status = status; this.code = code; this.details = details } }
function endpoint(path) { return `${env.apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}` }
export async function request(path, { method = 'GET', body, signal, headers = {}, token } = {}) {
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 10000)
  const relayAbort = () => controller.abort(); signal?.addEventListener('abort', relayAbort, { once: true })
  try {
    const response = await fetch(endpoint(path), { method, signal: controller.signal, headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new ApiClientError(payload?.error?.message || 'Request failed.', { status: response.status, code: payload?.error?.code, details: payload?.error?.details })
    return payload.data
  } finally { window.clearTimeout(timer); signal?.removeEventListener('abort', relayAbort) }
}
