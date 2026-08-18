#!/usr/bin/env node
/* One-time owner promotion.
 *
 * Grants `owner` on public.user_profiles to exactly one Neon Auth user id.
 *
 * Secondary to the staff bootstrap, which provisions an approved owner
 * automatically on sign-in. This remains for recovery: if OWNER_ALLOWED_EMAILS
 * is misconfigured or an address changes, it grants access without a deploy.
 *
 *   node --env-file=.env scripts/promote-admin.js <auth_user_id>
 *   node --env-file=.env scripts/promote-admin.js <auth_user_id> --demote
 *   node --env-file=.env scripts/promote-admin.js --list
 *
 * Why this is a script and not a feature:
 *
 *   Any HTTP route that can grant admin is a route that can be reached. There is
 *   no endpoint, no UI control, no Vite variable and no env-var-driven
 *   auto-promotion — running this requires a shell on the server and the
 *   database credential, which is the point.
 *
 *   It also refuses to guess. Not "the earliest profile", not an email match,
 *   not a name match: an exact `auth_user_id`. Every convenience alternative
 *   promotes the wrong account the day two people sign up in the same minute.
 *   Identity lives in Neon Auth; this table only records the business role.
 *
 * Reads DATABASE_URL from the environment and never takes it as an argument, so
 * it cannot end up in shell history.
 */

import pg from 'pg'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const args = process.argv.slice(2)
const list = args.includes('--list')
const demote = args.includes('--demote')
const target = args.find(value => !value.startsWith('--'))

function usage(message) {
  if (message) console.error(`\n  ${message}`)
  console.error(`
  Usage
    node --env-file=.env scripts/promote-admin.js <auth_user_id>
    node --env-file=.env scripts/promote-admin.js <auth_user_id> --demote
    node --env-file=.env scripts/promote-admin.js --list

  Finding the id
    The owner must sign up and sign in once first, so the application creates
    their profile row. Then take the user id from the Neon Console under
    Auth -> Users, or:

      SELECT id, email FROM neon_auth."user" ORDER BY "createdAt" DESC LIMIT 10;

    That id is the auth_user_id this script expects.
`)
  process.exit(1)
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) usage('DATABASE_URL is not set. Try: node --env-file=.env scripts/promote-admin.js <auth_user_id>')
  if (!list && !target) usage('An auth_user_id is required.')
  if (target && !UUID.test(target)) usage(`"${target}" is not a valid auth_user_id (expected a UUID).`)

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: /sslmode=require/.test(databaseUrl) ? { rejectUnauthorized: false } : false,
  })
  await client.connect()

  try {
    if (list) {
      const { rows } = await client.query(
        'SELECT auth_user_id, role, full_name, company_name, created_at FROM public.user_profiles ORDER BY created_at',
      )
      if (!rows.length) {
        console.log('\n  No profiles exist yet. The owner must sign up and sign in once first.\n')
        return
      }
      console.log('')
      for (const row of rows) {
        console.log(`  ${row.role === 'owner' ? '[owner]   ' : '[customer]'} ${row.auth_user_id}  ${row.full_name || '(no name)'}${row.company_name ? ` · ${row.company_name}` : ''}`)
      }
      console.log('')
      return
    }

    /* Refuse rather than create. A missing profile means the account has not
       signed in yet, and inserting one here would attach an admin role to a row
       the application never made — with no name, and no guarantee the id is even
       a real Neon Auth user. */
    const { rows: existing } = await client.query(
      'SELECT auth_user_id, role, full_name, company_name FROM public.user_profiles WHERE auth_user_id = $1',
      [target],
    )
    if (!existing.length) {
      console.error(`
  No profile exists for ${target}.

  This script never creates one. Sign in with that account once so the
  application creates its profile, then run this again.

  Use --list to see the profiles that do exist.
`)
      process.exit(1)
    }

    const current = existing[0]
    const role = demote ? 'customer' : 'owner'

    if (current.role === role) {
      console.log(`\n  No change: ${target} is already ${role}.\n`)
      return
    }

    const { rows: updated } = await client.query(
      'UPDATE public.user_profiles SET role = $1, updated_at = now() WHERE auth_user_id = $2 RETURNING auth_user_id, role, full_name, company_name',
      [role, target],
    )

    const row = updated[0]
    console.log(`
  ${demote ? 'Demoted' : 'Promoted'} exactly one profile:

    auth_user_id  ${row.auth_user_id}
    name          ${row.full_name || '(not set)'}
    company       ${row.company_name || '(not set)'}
    role          ${current.role}  ->  ${row.role}

  The role is read from the database on every request, but the browser caches
  the profile for the current session. Sign out and back in for it to apply.
`)
  } finally {
    await client.end()
  }
}

main().catch(error => { console.error(`\n  ${error.message}\n`); process.exit(1) })
