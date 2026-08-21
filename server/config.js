const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']

/* Validates the server-side Supabase pair.
 *
 * SUPABASE_URL is the project origin (https://<ref>.supabase.co). The service
 * role key is a JWT whose `role` claim is `service_role`. Pasting the
 * publishable (anon) key here is the likely mistake: the API would start, auth
 * calls would behave oddly, and the key would still be a secret in the wrong
 * slot. Caught at boot rather than in production traffic.
 *
 * The check only reads the JWT payload. It does not verify the signature —
 * that is Supabase's job when the key is used. */
function decodeJwtPayload(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function validateSupabase(url, serviceRoleKey) {
  let parsed
  try { parsed = new URL(url) } catch {
    throw new Error('SUPABASE_URL must be an absolute URL, for example https://<project-ref>.supabase.co')
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(`SUPABASE_URL must be the project origin with no path. Expected "${parsed.origin}", got "${url}".`)
  }
  const payload = decodeJwtPayload(serviceRoleKey)
  if (!payload) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be the service_role JWT from Supabase Settings → API.')
  }
  if (payload.role !== 'service_role') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not the service_role key. The publishable/anon key belongs only in VITE_SUPABASE_PUBLISHABLE_KEY.')
  }
}

export function serverConfig(source = process.env) {
  const missing = required.filter(name => !source[name])
  if (missing.length) throw new Error(`Missing required server environment variables: ${missing.join(', ')}`)
  validateSupabase(source.SUPABASE_URL, source.SUPABASE_SERVICE_ROLE_KEY)
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

  const supabaseUrl = source.SUPABASE_URL.replace(/\/+$/, '')
  const publicStorage = (source.OBJECT_STORAGE_PUBLIC_BASE_URL || '').trim()
    || `${supabaseUrl}/storage/v1/object/public/motion-public`

  return Object.freeze({
    databaseUrl: source.DATABASE_URL,
    supabaseUrl,
    supabaseServiceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY,
    allowedOrigins: (source.API_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
    timeoutMs: Number(source.API_REQUEST_TIMEOUT_MS || 10000),
    trustedClientHeader: trustedClientHeader || null,
    ownerAllowedEmails,
    // Lets the staff route distinguish 'not approved' from 'not configured'
    // without revealing either to the caller.
    ownersConfigured,
    rateLimit: { windowMs: Number(source.API_RATE_LIMIT_WINDOW_MS || 60000), max: Number(source.API_RATE_LIMIT_MAX_REQUESTS || 100), maxKeys: Number(source.API_RATE_LIMIT_MAX_KEYS || 10000) },
    storage: { publicBaseUrl: publicStorage },
  })
}
