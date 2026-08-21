/* Which DATABASE_URL the migration runner will accept.

   Direct db.<project-ref>.supabase.co:5432 is preferred when IPv6 works.
   Session Pooler *.pooler.supabase.com:5432 is the supported IPv4 fallback.
   Transaction Pooler port 6543 is never accepted. */

function isSupabasePoolerHost(hostname) {
  const host = String(hostname || '').toLowerCase()
  return host === 'pooler.supabase.com' || host.endsWith('.pooler.supabase.com')
}

/**
 * Throws if the URI is the Transaction Pooler (port 6543) or a pooler on any
 * port other than 5432. Direct hosts and Session Pooler :5432 are allowed.
 * Unparseable strings are left for connect() to fail with a clearer error.
 */
export function assertMigrationConnection(connectionString) {
  let url
  try {
    url = new URL(connectionString)
  } catch {
    return
  }

  const port = url.port || '5432'
  const pooler = isSupabasePoolerHost(url.hostname)

  if (port === '6543') {
    throw new Error(
      'DATABASE_URL points at the Supabase Transaction Pooler (port 6543).\n'
      + 'Migrations take an advisory lock on one client and must use Direct\n'
      + '(db.<project-ref>.supabase.co:5432) or Session Pooler\n'
      + '(*.pooler.supabase.com:5432). Never port 6543.\n'
      + 'See SUPABASE.md.',
    )
  }

  if (pooler && port !== '5432') {
    throw new Error(
      'DATABASE_URL points at a Supabase pooler on a non-session port.\n'
      + 'Use Session Pooler port 5432. See SUPABASE.md.',
    )
  }
}
