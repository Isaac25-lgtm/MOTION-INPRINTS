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
export function createHttpHandler(api, { allowedOrigins, rateLimit }, { getClientKey } = {}) {
  const take = createMemoryRateLimiter(rateLimit)
  return async function handler(request) {
    const origin = request.headers.get('origin')
    const cors = origin && allowedOrigins.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}
    if (origin && !allowedOrigins.includes(origin)) return fail(new ApiError(403, 'origin_not_allowed', 'Origin is not allowed.'))
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'authorization,content-type' } })
    // A raw Fetch Request has no trustworthy peer-IP. A deployment adapter may inject a verified key.
    const client = getClientKey?.(request) || 'anonymous'
    if (!take(client)) return fail(new ApiError(429, 'rate_limited', 'Too many requests. Please try again shortly.'))
    const response = await api(request)
    Object.entries(cors).forEach(([name, value]) => response.headers.set(name, value))
    return response
  }
}
