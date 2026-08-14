#!/usr/bin/env node
/* Migration runner.

   Applies db/migrations/*.sql in filename order, records each in
   schema_migrations, and refuses to run a file whose contents changed after it
   was applied — an edited migration is a different migration, and silently
   re-applying or skipping it is how environments drift apart.

   Uses node-postgres rather than the Neon HTTP driver: the HTTP driver only talks
   to a Neon endpoint, whereas this connects over standard TCP and therefore works
   against a local Postgres and against Neon alike. That is what makes it possible
   to rehearse a migration locally before it touches the hosted database.

   Usage:  node --env-file=.env db/migrate.js [--dry-run]
   Reads DATABASE_URL from the environment. Never takes a connection string as an
   argument, so it cannot end up in shell history. */

import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import pg from 'pg'

const MIGRATIONS_DIR = new URL('./migrations/', import.meta.url)
const dryRun = process.argv.includes('--dry-run')

const checksum = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)

/** Describes the target without ever printing credentials. */
function describe(connectionString) {
  try {
    const url = new URL(connectionString)
    return `${url.hostname}:${url.port || 5432}${url.pathname}`
  } catch {
    return 'the configured database'
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Try: node --env-file=.env db/migrate.js')
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    // Neon requires TLS; a local server generally has none. Trust the URL's own
    // sslmode, defaulting to off only for loopback.
    ssl: /sslmode=require/.test(databaseUrl) ? { rejectUnauthorized: false } : false,
  })

  await client.connect()
  // Serialize migration runners. Two deploys starting together must not both
  // read the same pending set and race to create the same tables or constraints.
  await client.query("SELECT pg_advisory_lock(hashtext('motion_schema_migrations'))")
  const { rows: [version] } = await client.query('SELECT version()')
  console.log(`  target   ${describe(databaseUrl)}`)
  console.log(`  server   ${version.version.split(',')[0]}\n`)

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(MIGRATIONS_DIR)).filter(name => name.endsWith('.sql')).sort()
  const { rows: appliedRows } = await client.query('SELECT filename, checksum FROM public.schema_migrations')
  const applied = new Map(appliedRows.map(row => [row.filename, row.checksum]))

  let pending = 0
  let failed = false

  for (const filename of files) {
    const contents = await readFile(new URL(filename, MIGRATIONS_DIR), 'utf8')
    const digest = checksum(contents)
    const previous = applied.get(filename)

    if (previous) {
      if (previous !== digest) {
        console.error(`\n  ${filename} has changed since it was applied (${previous} -> ${digest}).`)
        console.error('  Applied migrations are immutable. Add a new migration instead of editing this one.')
        failed = true
        break
      }
      console.log(`  skip     ${filename}`)
      continue
    }

    pending += 1
    if (dryRun) { console.log(`  pending  ${filename}`); continue }

    process.stdout.write(`  apply    ${filename} ... `)
    try {
      // One transaction per migration: Postgres runs DDL transactionally, so a
      // failure part-way rolls the whole file back rather than leaving a
      // half-migrated schema.
      await client.query('BEGIN')
      await client.query(contents)
      await client.query('INSERT INTO public.schema_migrations(filename, checksum) VALUES ($1, $2)', [filename, digest])
      await client.query('COMMIT')
      console.log('ok')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      console.log('FAILED')
      console.error(`\n  ${filename}`)
      console.error(`  ${error.message}`)
      if (error.position) console.error(`  at character ${error.position}`)
      if (error.hint) console.error(`  hint: ${error.hint}`)
      failed = true
      break
    }
  }

  await client.end()

  if (failed) process.exit(1)
  if (!pending) console.log('\n  schema is up to date')
  else if (dryRun) console.log(`\n  ${pending} migration(s) pending`)
  else console.log(`\n  applied ${pending} migration(s)`)
}

main().catch(error => { console.error(error.message); process.exit(1) })
