const required = ['DATABASE_URL', 'NEON_AUTH_JWKS_URL', 'NEON_AUTH_ISSUER']
export function serverConfig(source = process.env) {
  const missing = required.filter(name => !source[name])
  if (missing.length) throw new Error(`Missing required server environment variables: ${missing.join(', ')}`)
  return Object.freeze({
    databaseUrl: source.DATABASE_URL,
    authJwksUrl: source.NEON_AUTH_JWKS_URL,
    authIssuer: source.NEON_AUTH_ISSUER,
    allowedOrigins: (source.API_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
    timeoutMs: Number(source.API_REQUEST_TIMEOUT_MS || 10000),
    rateLimit: { windowMs: Number(source.API_RATE_LIMIT_WINDOW_MS || 60000), max: Number(source.API_RATE_LIMIT_MAX_REQUESTS || 100), maxKeys: Number(source.API_RATE_LIMIT_MAX_KEYS || 10000) },
    storage: { endpoint: source.OBJECT_STORAGE_ENDPOINT, bucket: source.OBJECT_STORAGE_BUCKET, publicBaseUrl: source.OBJECT_STORAGE_PUBLIC_BASE_URL },
  })
}
