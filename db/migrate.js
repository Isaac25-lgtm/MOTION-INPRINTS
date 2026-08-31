#!/usr/bin/env node
/* Migration runner.

   Applies db/migrations/*.sql in filename order, records each in
   schema_migrations, and refuses to run a file whose contents changed after it
   was applied — an edited migration is a different migration, and silently
   re-applying or skipping it is how environments drift apart.

   Uses one node-postgres Client over standard TCP and holds
   pg_advisory_lock for the whole run. Prefers MIGRATION_DATABASE_URL (direct,
   unpooled Neon). Falls back to DATABASE_URL only for local development when
   that URL is itself direct. Pooled Neon URLs are rejected.

   `--dry-run` connects and reads only. It does not take the advisory lock, does
   not create schema_migrations, and does not apply files.

   Usage:  node --env-file=.env db/migrate.js [--dry-run]
   Reads connection strings from the environment. Never takes a connection string
   as an argument, so it cannot end up in shell history. */

import { readdir, readFile } from 'node:fs/promises'
import pg from 'pg'
import { sslFor } from '../server/db.js'
import { resolveMigrationDatabaseUrl } from './migration-connection.js'
import { runMigrations } from './run-migrations.js'

const MIGRATIONS_DIR = new URL('./migrations/', import.meta.url)
const dryRun = process.argv.includes('--dry-run')

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
  let databaseUrl
  try {
    databaseUrl = resolveMigrationDatabaseUrl(process.env)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: sslFor(databaseUrl),
  })

  await client.connect()
  const names = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort()
  const files = []
  for (const filename of names) {
    files.push({ filename, contents: await readFile(new URL(filename, MIGRATIONS_DIR), 'utf8') })
  }

  console.log(`  target   ${describe(databaseUrl)}`)

  const result = await runMigrations(client, { dryRun, files, log: {
    log: (...args) => console.log(...args),
    error: (...args) => console.error(...args),
    write: (text) => process.stdout.write(text),
  } })

  if (result.version) console.log(`  server   ${result.version.split(',')[0]}\n`)

  await client.end()

  if (result.failed) process.exit(1)
  if (!result.pending) console.log('\n  schema is up to date')
  else if (dryRun) console.log(`\n  ${result.pending} migration(s) pending`)
  else console.log(`\n  applied ${result.pending} migration(s)`)
}

const isEntryPoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href
if (isEntryPoint) {
  main().catch((error) => { console.error(error.message); process.exit(1) })
}
