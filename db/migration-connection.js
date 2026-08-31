/* Which connection the migration runner will accept.

   Migrations take a session advisory lock, so they must use a direct Postgres
   connection. Neon pooled endpoints (-pooler host, pgbouncer=true, port 6543)
   are rejected. Local unpooled URLs are allowed as a DATABASE_URL fallback. */

export function isPooledNeonUrl(connectionString) {
  let url
  try {
    url = new URL(connectionString)
  } catch {
    return false
  }
  const host = url.hostname.toLowerCase()
  const port = url.port || '5432'
  if (port === '6543') return true
  if (host.includes('-pooler') || host.includes('pooler.')) return true
  if (url.searchParams.get('pgbouncer') === 'true') return true
  return false
}

export function isDirectLocalUrl(connectionString) {
  try {
    const url = new URL(connectionString)
    const host = url.hostname.toLowerCase()
    return (host === 'localhost' || host === '127.0.0.1' || host === '::1') && !isPooledNeonUrl(connectionString)
  } catch {
    return false
  }
}

/**
 * Throws if the URI cannot hold a session advisory lock.
 */
export function assertMigrationConnection(connectionString) {
  let url
  try {
    url = new URL(connectionString)
  } catch {
    return
  }

  if (isPooledNeonUrl(connectionString)) {
    throw new Error(
      'Migrations must use a direct, unpooled Postgres connection (MIGRATION_DATABASE_URL).\n'
      + 'Pooled Neon URLs cannot hold a session advisory lock.\n'
      + `Refusing ${url.hostname}:${url.port || 5432}.`,
    )
  }
}

/**
 * Resolves the migration target. Prefers MIGRATION_DATABASE_URL. Falls back to
 * DATABASE_URL only when that URL is itself a direct (unpooled) connection —
 * the local-development case.
 */
export function resolveMigrationDatabaseUrl(source = process.env) {
  const dedicated = String(source.MIGRATION_DATABASE_URL || '').trim()
  if (dedicated) {
    assertMigrationConnection(dedicated)
    return dedicated
  }
  const fallback = String(source.DATABASE_URL || '').trim()
  if (!fallback) {
    throw new Error('MIGRATION_DATABASE_URL is not set. For local development a direct DATABASE_URL may be used instead.')
  }
  if (!isDirectLocalUrl(fallback)) {
    throw new Error(
      'DATABASE_URL fallback is allowed only for a direct localhost Postgres database. Set MIGRATION_DATABASE_URL to the direct, unpooled Neon URL.',
    )
  }
  assertMigrationConnection(fallback)
  return fallback
}
