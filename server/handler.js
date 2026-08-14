import { ApiError, fail } from './http.js'

export function createMemoryRateLimiter({ windowMs, max, maxKeys = 10000 }) {
  const buckets = new Map()
  return (key) => {
    const now = Date.now()
    for (const [bucketKey, timestamps] of buckets) if (!timestamps.some(time => now - time < windowMs)) buckets.delete(bucketKey)
    if (!buckets.has(key) && buckets.size >= maxKeys) return false
    const active = (buckets.get(key) || []).filter(time => now - time < windowMs)
    if (active.length >= max) return false
    active.push(now); buckets.set(key, active); return true
  }
}

// Non-cryptographic bucket label. It must never be reversible to the bearer token it summarises.
function fingerprint(value) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193) >>> 0 }
  return hash.toString(36)
}

// A raw Fetch Request carries no trustworthy peer address, and any client can forge `x-forwarded-for`.
// Only a header the deployment runtime is known to overwrite may be trusted, so it is named in configuration.
// Returns null when the caller cannot be distinguished; the handler then skips limiting rather than
// forcing every visitor into one shared bucket, which would rate-limit the whole site as a single client.
export function createClientKeyResolver({ trustedClientHeader } = {}) {
  return (request) => {
    if (trustedClientHeader) {
      const forwarded = request.headers.get(trustedClientHeader)?.split(',')[0].trim()
      if (forwarded) return `client:${forwarded}`
    }
    const authorization = request.headers.get('authorization')
    if (authorization) return `session:${fingerprint(authorization)}`
    return null
  }
}

export function createHttpHandler(api, config, { getClientKey = createClientKeyResolver(config) } = {}) {
  const { allowedOrigins, rateLimit } = config
  const take = createMemoryRateLimiter(rateLimit)
  return async function handler(request) {
    const origin = request.headers.get('origin')
    const cors = origin && allowedOrigins.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}
    if (origin && !allowedOrigins.includes(origin)) return fail(new ApiError(403, 'origin_not_allowed', 'Origin is not allowed.'))
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'authorization,content-type' } })
    const client = getClientKey(request)
    if (client && !take(client)) return fail(new ApiError(429, 'rate_limited', 'Too many requests. Please try again shortly.'))
    const response = await api(request)
    Object.entries(cors).forEach(([name, value]) => response.headers.set(name, value))
    return response
  }
}
