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
  /* Rate-limit identity for anonymous callers.
   *
   * This must name a header the runtime OVERWRITES. A header the runtime merely
   * appends to is client-supplied, and naming one is worse than naming none:
   * `createClientKeyResolver` would hand every anonymous caller a bucket they
   * choose for themselves, while the code reads as though limiting is in force.
   *
   * Render appends to `X-Forwarded-For` rather than replacing it, so its first
   * value is attacker-controlled. Cloudflare's `CF-Connecting-IP` is overwritten
   * at Cloudflare's edge, but Render does not document it and an application
   * cannot verify from inside that a request actually arrived through that edge,
   * so trusting it would just move the same assumption somewhere less visible.
   *
   * Hence the literal `none`: a deliberate, greppable statement that this
   * platform offers no trustworthy header and anonymous callers are therefore
   * not rate limited. It satisfies the production guard because it is a decision
   * on the record, not an empty variable someone forgot to set — which is the
   * only thing the guard was ever there to catch.
   */
  const declared = (source.API_TRUSTED_CLIENT_HEADER || '').trim().toLowerCase()
  if (!declared && source.NODE_ENV === 'production') {
    throw new Error('API_TRUSTED_CLIENT_HEADER must name the header your API runtime OVERWRITES with the real client address, or the literal "none" if the platform provides no such header. Naming a header the platform merely appends to lets any caller choose their own rate-limit bucket.')
  }
  const trustedClientHeader = declared === 'none' ? null : declared

  /* Exactly two addresses, or nobody is approved.
   *
   * Validated on the RAW normalised list, deliberately BEFORE any
   * deduplication. Collapsing duplicates first was a real hole:
   *
   *     owner1@x.com,owner1@x.com,owner2@x.com
   *
   * became two unique addresses and was accepted, so a list that plainly does
   * not name two owners silently passed. Someone editing the variable in a
   * hurry, or pasting a line twice, would have got a working configuration
   * that did not say what they thought it said.
   *
   * The order is now: split, normalise, drop blanks, then require exactly two
   * SUPPLIED entries, both well-formed, and distinct from each other. Any
   * failure resolves to EMPTY, which approves nobody — a half-configured
   * allowlist must never mean "approve whoever is left".
   *
   * It deliberately does NOT throw. Staff configuration is not a reason to stop
   * a customer buying: the public API, checkout, quotes and tracking all work
   * regardless, and only the staff bootstrap route reports the problem, as a
   * neutral refusal that names nothing.
   */
  const suppliedOwners = (source.OWNER_ALLOWED_EMAILS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)

  const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/
  const ownersConfigured =
    suppliedOwners.length === 2 &&
    suppliedOwners.every(value => EMAIL.test(value)) &&
    // Distinct after normalising, so the same address in two cases is caught.
    new Set(suppliedOwners).size === 2

  const ownerAllowedEmails = ownersConfigured ? suppliedOwners : []

  return Object.freeze({
    databaseUrl: source.DATABASE_URL,
    authJwksUrl: source.NEON_AUTH_JWKS_URL,
    authIssuer: source.NEON_AUTH_ISSUER,
    allowedOrigins: (source.API_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
    timeoutMs: Number(source.API_REQUEST_TIMEOUT_MS || 10000),
    trustedClientHeader: trustedClientHeader || null,
    ownerAllowedEmails,
    // Lets the staff route distinguish 'not approved' from 'not configured'
    // without revealing either to the caller.
    ownersConfigured,
    rateLimit: { windowMs: Number(source.API_RATE_LIMIT_WINDOW_MS || 60000), max: Number(source.API_RATE_LIMIT_MAX_REQUESTS || 100), maxKeys: Number(source.API_RATE_LIMIT_MAX_KEYS || 10000) },
    storage: { endpoint: source.OBJECT_STORAGE_ENDPOINT, bucket: source.OBJECT_STORAGE_BUCKET, publicBaseUrl: source.OBJECT_STORAGE_PUBLIC_BASE_URL },
  })
}
