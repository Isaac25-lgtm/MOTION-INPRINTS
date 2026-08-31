import { parseAdminUsers } from './admins.js'
import { sessionHoursFrom } from './sessions.js'

const required = ['DATABASE_URL']

function assertNeonRuntimeRole(connectionString, production) {
  if (!production) return
  try {
    const url = new URL(connectionString)
    if (url.hostname.toLowerCase().endsWith('.neon.tech') && url.username !== 'motion_app') {
      throw new Error('Production Neon DATABASE_URL must use the restricted motion_app role, not the database owner.')
    }
  } catch (error) {
    if (error.message.includes('motion_app')) throw error
  }
}

export function serverConfig(source = process.env) {
  const missing = required.filter((name) => !source[name])
  if (missing.length) throw new Error(`Missing required server environment variables: ${missing.join(', ')}`)

  const production = source.NODE_ENV === 'production'
  assertNeonRuntimeRole(source.DATABASE_URL, production)
  const admins = parseAdminUsers(source.ADMIN_USERS_JSON, { required: production })

  const declared = (source.API_TRUSTED_CLIENT_HEADER || '').trim().toLowerCase()
  if (!declared && production) {
    throw new Error('API_TRUSTED_CLIENT_HEADER must name the header your API runtime OVERWRITES with the real client address, or the literal "none" if the platform provides no such header. Naming a header the platform merely appends to lets any caller choose their own rate-limit bucket.')
  }
  const trustedClientHeader = declared === 'none' ? null : declared

  const obsolete = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OWNER_ALLOWED_EMAILS',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_GOOGLE',
    'VITE_NEON_AUTH_URL',
    'VITE_NEON_AUTH_GOOGLE',
    'NEON_AUTH_JWKS_URL',
    'NEON_AUTH_ISSUER',
  ].filter((name) => String(source[name] || '').trim())
  if (obsolete.length) {
    throw new Error(`${obsolete.join(' and ')} are obsolete. Motion uses Neon PostgreSQL and server-owned administrator sessions. See ENVIRONMENT.md.`)
  }

  const publicStorage = (source.OBJECT_STORAGE_PUBLIC_BASE_URL || '').trim()
  const anonymousMutationMax = Number(source.API_ANONYMOUS_MUTATION_MAX || 20)
  if (!Number.isSafeInteger(anonymousMutationMax) || anonymousMutationMax < 1 || anonymousMutationMax > 1000) {
    throw new Error('API_ANONYMOUS_MUTATION_MAX must be an integer between 1 and 1000.')
  }

  return Object.freeze({
    databaseUrl: source.DATABASE_URL,
    migrationDatabaseUrl: (source.MIGRATION_DATABASE_URL || '').trim() || null,
    allowedOrigins: (source.API_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
    timeoutMs: Number(source.API_REQUEST_TIMEOUT_MS || 10000),
    trustedClientHeader: trustedClientHeader || null,
    admins,
    adminSessionHours: sessionHoursFrom(source.ADMIN_SESSION_HOURS),
    rateLimit: {
      windowMs: Number(source.API_RATE_LIMIT_WINDOW_MS || 60000),
      max: Number(source.API_RATE_LIMIT_MAX_REQUESTS || 100),
      maxKeys: Number(source.API_RATE_LIMIT_MAX_KEYS || 10000),
      anonymousMutationMax,
    },
    storage: { publicBaseUrl: publicStorage },
  })
}
