const required = ['DATABASE_URL', 'NEON_AUTH_JWKS_URL', 'NEON_AUTH_ISSUER']

/* Validates the two Neon Auth values together.
 *
 * The issuer is the ORIGIN of the Neon Auth URL, while the JWKS lives under its
 * full path — for `https://ep-x.neonauth.../neondb/auth` the issuer is
 * `https://ep-x.neonauth...` and the JWKS is
 * `https://ep-x.neonauth.../neondb/auth/.well-known/jwks.json`.
 *
 * The easy mistake is pasting the same value into both, or giving the issuer a
 * trailing path. Either produces tokens that verify cryptographically and are
 * then rejected on the issuer claim, which reads like a broken login rather than
 * a configuration error. Caught here instead, at startup. */
function validateAuth(jwksUrl, issuer) {
  let jwks, iss
  try { jwks = new URL(jwksUrl) } catch { throw new Error('NEON_AUTH_JWKS_URL must be an absolute URL ending in /.well-known/jwks.json') }
  try { iss = new URL(issuer) } catch { throw new Error('NEON_AUTH_ISSUER must be an absolute URL, and is the ORIGIN of your Neon Auth URL with no path.') }

  if (!jwks.pathname.endsWith('/.well-known/jwks.json')) {
    throw new Error('NEON_AUTH_JWKS_URL must end in /.well-known/jwks.json')
  }
  if (iss.pathname !== '/' && iss.pathname !== '') {
    throw new Error(`NEON_AUTH_ISSUER must be an origin with no path. Expected "${iss.origin}", got "${issuer}".`)
  }
  if (jwks.origin !== iss.origin) {
    throw new Error(`NEON_AUTH_ISSUER (${iss.origin}) and NEON_AUTH_JWKS_URL (${jwks.origin}) must share an origin.`)
  }
}

export function serverConfig(source = process.env) {
  const missing = required.filter(name => !source[name])
  if (missing.length) throw new Error(`Missing required server environment variables: ${missing.join(', ')}`)
  validateAuth(source.NEON_AUTH_JWKS_URL, source.NEON_AUTH_ISSUER)
  const trustedClientHeader = (source.API_TRUSTED_CLIENT_HEADER || '').trim().toLowerCase()
  // Without a runtime-controlled client header, anonymous callers cannot be told apart and go unlimited.
  // That is workable while developing but must never reach production, so refuse to start instead.
  if (!trustedClientHeader && source.NODE_ENV === 'production') throw new Error('API_TRUSTED_CLIENT_HEADER must name the header your API runtime sets to the real client address before running in production.')
  return Object.freeze({
    databaseUrl: source.DATABASE_URL,
    authJwksUrl: source.NEON_AUTH_JWKS_URL,
    authIssuer: source.NEON_AUTH_ISSUER,
    allowedOrigins: (source.API_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
    timeoutMs: Number(source.API_REQUEST_TIMEOUT_MS || 10000),
    trustedClientHeader: trustedClientHeader || null,
    rateLimit: { windowMs: Number(source.API_RATE_LIMIT_WINDOW_MS || 60000), max: Number(source.API_RATE_LIMIT_MAX_REQUESTS || 100), maxKeys: Number(source.API_RATE_LIMIT_MAX_KEYS || 10000) },
    storage: { endpoint: source.OBJECT_STORAGE_ENDPOINT, bucket: source.OBJECT_STORAGE_BUCKET, publicBaseUrl: source.OBJECT_STORAGE_PUBLIC_BASE_URL },
  })
}
