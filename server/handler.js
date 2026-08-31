import { ApiError, fail } from './http.js'

export function createMemoryRateLimiter({ windowMs, max, maxKeys = 10000 }) {
  const buckets = new Map()
  return (key) => {
    const now = Date.now()
    for (const [bucketKey, timestamps] of buckets) {
      if (!timestamps.some(time => now - time < windowMs)) buckets.delete(bucketKey)
    }
    if (!buckets.has(key) && buckets.size >= maxKeys) return false
    const active = (buckets.get(key) || []).filter(time => now - time < windowMs)
    if (active.length >= max) return false
    active.push(now)
    buckets.set(key, active)
    return true
  }
}

// A raw Fetch Request has no trustworthy peer address. Only a deployment header
// known to be overwritten with the real client address may identify a caller.
// Authorization is excluded because public endpoints do not verify bearer tokens;
// rotating fake values must not bypass the limiter.
export function createClientKeyResolver({ trustedClientHeader } = {}) {
  return (request) => {
    if (!trustedClientHeader) return null
    const forwarded = request.headers.get(trustedClientHeader)?.split(',')[0].trim()
    return forwarded ? `client:${forwarded}` : null
  }
}

function isMutatingRequest(request) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
}

function globalMutationKey(request) {
  return `mutation:${request.method}:${new URL(request.url).pathname}`
}

export function createHttpHandler(api, config, { getClientKey = createClientKeyResolver(config) } = {}) {
  const { allowedOrigins, rateLimit } = config
  const take = createMemoryRateLimiter(rateLimit)
  const takeAnonymousMutation = createMemoryRateLimiter({
    windowMs: rateLimit.windowMs,
    max: rateLimit.anonymousMutationMax,
    maxKeys: rateLimit.maxKeys,
  })

  return async function handler(request) {
    const origin = request.headers.get('origin')
    const cors = origin && allowedOrigins.includes(origin)
      ? { 'access-control-allow-origin': origin, vary: 'Origin' }
      : {}
    if (origin && !allowedOrigins.includes(origin)) {
      return fail(new ApiError(403, 'origin_not_allowed', 'Origin is not allowed.'))
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          'access-control-allow-headers': 'authorization,content-type',
        },
      })
    }

    const client = getClientKey(request)
    if (client && !take(client)) {
      return fail(new ApiError(429, 'rate_limited', 'Too many requests. Please try again shortly.'))
    }
    if (!client && isMutatingRequest(request) && !takeAnonymousMutation(globalMutationKey(request))) {
      return fail(new ApiError(429, 'rate_limited', 'Too many requests. Please try again shortly.'))
    }

    const response = await api(request)
    Object.entries(cors).forEach(([name, value]) => response.headers.set(name, value))
    return response
  }
}
