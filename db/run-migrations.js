import { checksum } from './migration-checksum.js'

export { checksum }

export const SCHEMA_MIGRATIONS_DDL = `
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `

const isUndefinedTable = (error) => error && error.code === '42P01'

/**
 * One pass over the migration files. `client.query` is the only database access.
 * Dry-run issues reads (version + optional schema_migrations SELECT) and nothing
 * that writes: no lock, no DDL, no INSERT, no BEGIN.
 */
export async function runMigrations(client, { dryRun: isDryRun, files, log = console }) {
  if (!isDryRun) {
    await client.query("SELECT pg_advisory_lock(hashtext('motion_schema_migrations'))")
  }

  const { rows: [version] } = await client.query('SELECT version()')

  if (!isDryRun) {
    await client.query(SCHEMA_MIGRATIONS_DDL)
  }

  let applied = new Map()
  try {
    const { rows: appliedRows } = await client.query('SELECT filename, checksum FROM public.schema_migrations')
    applied = new Map(appliedRows.map(row => [row.filename, row.checksum]))
  } catch (error) {
    if (!(isDryRun && isUndefinedTable(error))) throw error
  }

  let pending = 0
  let failed = false

  for (const { filename, contents } of files) {
    const digest = checksum(contents)
    const previous = applied.get(filename)

    if (previous) {
      if (previous !== digest) {
        log.error(`\n  ${filename} has changed since it was applied (${previous} -> ${digest}).`)
        log.error('  Applied migrations are immutable. Add a new migration instead of editing this one.')
        failed = true
        break
      }
      log.log(`  skip     ${filename}`)
      continue
    }

    pending += 1
    if (isDryRun) { log.log(`  pending  ${filename}`); continue }

    if (typeof log.write === 'function') log.write(`  apply    ${filename} ... `)
    else log.log(`  apply    ${filename} ...`)
    try {
      await client.query('BEGIN')
      await client.query(contents)
      await client.query('INSERT INTO public.schema_migrations(filename, checksum) VALUES ($1, $2)', [filename, digest])
      await client.query('COMMIT')
      log.log('ok')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      log.log('FAILED')
      log.error(`\n  ${filename}`)
      log.error(`  ${error.message}`)
      if (error.position) log.error(`  at character ${error.position}`)
      if (error.hint) log.error(`  hint: ${error.hint}`)
      failed = true
      break
    }
  }

  return { pending, failed, version: version?.version }
}
