import { describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { assertMigrationConnection } from '../db/migration-connection.js'
import { checksum } from '../db/migration-checksum.js'
import { runMigrations } from '../db/run-migrations.js'
import { generateBootstrapSql, stripOuterTransaction } from '../scripts/generate-supabase-bootstrap.js'

const direct = 'postgresql://postgres:x@db.example.supabase.co:5432/postgres'
const session = 'postgresql://postgres.example:x@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
const transaction = 'postgresql://postgres.example:x@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
const silent = { log() {}, error() {}, write() {} }

const migrationDir = new URL('../db/migrations/', import.meta.url)

const loadFiles = async () => {
  const names = (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort()
  const files = []
  for (const filename of names) {
    files.push({ filename, contents: await readFile(new URL(filename, migrationDir), 'utf8') })
  }
  return files
}

describe('migration DATABASE_URL guard', () => {
  it('accepts a Direct connection', () => {
    expect(() => assertMigrationConnection(direct)).not.toThrow()
  })

  it('accepts Session Pooler port 5432', () => {
    expect(() => assertMigrationConnection(session)).not.toThrow()
  })

  it('refuses pooler port 6543', () => {
    expect(() => assertMigrationConnection(transaction)).toThrow(/6543/)
    expect(() => assertMigrationConnection(transaction)).toThrow(/Transaction Pooler/)
  })
})

describe('migration runner design', () => {
  it('still uses one Client and an advisory lock', async () => {
    const source = await readFile(fileURLToPath(new URL('../db/migrate.js', import.meta.url)), 'utf8')
    const runner = await readFile(fileURLToPath(new URL('../db/run-migrations.js', import.meta.url)), 'utf8')
    expect(source).toContain('new pg.Client')
    expect(runner).toContain("pg_advisory_lock(hashtext('motion_schema_migrations'))")
    expect(source).not.toMatch(/new pg\.Pool/)
    expect(source).toContain('assertMigrationConnection')
    expect(source).not.toContain('pg_terminate_backend')
    expect(runner).not.toContain('pg_terminate_backend')
  })
})

describe('dry-run makes no database writes', () => {
  const files = [
    { filename: '0001_example.sql', contents: 'CREATE TABLE public.example (id int);' },
  ]

  it('does not create schema_migrations, lock, or apply when the table is missing', async () => {
    const sql = []
    const client = {
      query: async (statement) => {
        sql.push(statement)
        if (/SELECT version\(\)/i.test(statement)) return { rows: [{ version: 'PostgreSQL 17.6' }] }
        if (/schema_migrations/i.test(statement)) {
          const error = new Error('relation "schema_migrations" does not exist')
          error.code = '42P01'
          throw error
        }
        return { rows: [] }
      },
    }
    const result = await runMigrations(client, { dryRun: true, files, log: silent })
    expect(result.failed).toBe(false)
    expect(result.pending).toBe(1)
    expect(sql.some((statement) => /CREATE TABLE/i.test(statement))).toBe(false)
    expect(sql.some((statement) => /pg_advisory_lock/i.test(statement))).toBe(false)
    expect(sql.some((statement) => /^\s*BEGIN/i.test(statement))).toBe(false)
    expect(sql.some((statement) => /INSERT INTO public\.schema_migrations/i.test(statement))).toBe(false)
    expect(sql.some((statement) => /pg_terminate_backend/i.test(statement))).toBe(false)
  })

  it('only reads schema_migrations when the table already exists', async () => {
    const sql = []
    const client = {
      query: async (statement) => {
        sql.push(statement)
        if (/SELECT version\(\)/i.test(statement)) return { rows: [{ version: 'PostgreSQL 17.6' }] }
        if (/SELECT filename, checksum FROM public.schema_migrations/i.test(statement)) {
          return { rows: [{ filename: '0001_example.sql', checksum: checksum(files[0].contents) }] }
        }
        return { rows: [] }
      },
    }
    const result = await runMigrations(client, { dryRun: true, files, log: silent })
    expect(result.pending).toBe(0)
    expect(sql.some((statement) => /CREATE TABLE/i.test(statement))).toBe(false)
    expect(sql.some((statement) => /pg_advisory_lock/i.test(statement))).toBe(false)
    expect(sql.some((statement) => /^\s*BEGIN/i.test(statement))).toBe(false)
    expect(sql.some((statement) => /INSERT INTO/i.test(statement))).toBe(false)
  })
})

describe('SQL Editor bootstrap generator', () => {
  it('includes all 14 migrations in order with runner checksums', async () => {
    const files = await loadFiles()
    expect(files.map((file) => file.filename)).toEqual([
      '0001_motion_core.sql',
      '0002_initial_taxonomy.sql',
      '0003_pricing_components.sql',
      '0004_quotes_and_orders.sql',
      '0005_portfolio_and_cms.sql',
      '0006_quote_status_vocabulary.sql',
      '0007_accepted_quote_immutability.sql',
      '0008_quote_access_and_lifecycle.sql',
      '0009_catalogue_relationships_and_uploads.sql',
      '0010_proofs_tracking_and_audit.sql',
      '0011_proof_evidence_integrity.sql',
      '0012_proof_supersession_invariant.sql',
      '0013_owner_role_and_digital_first.sql',
      '0014_supabase_rls_and_storage.sql',
    ])
    const sql = generateBootstrapSql(files)
    let cursor = 0
    for (const file of files) {
      const digest = checksum(file.contents)
      const stamp = `INSERT INTO public.schema_migrations(filename, checksum) VALUES ('${file.filename}', '${digest}');`
      const index = sql.indexOf(stamp)
      expect(index, file.filename).toBeGreaterThan(cursor)
      cursor = index
      expect(sql).toContain(`-- ${file.filename}`)
      const body = stripOuterTransaction(file.contents).replace(/\s+$/, '')
      expect(sql).toContain(body)
    }
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.schema_migrations/)
    const begins = sql.match(/^BEGIN;/gm) || []
    const commits = sql.match(/^COMMIT;/gm) || []
    expect(begins).toHaveLength(14)
    expect(commits).toHaveLength(14)
  })

  it('does not put secrets, env names, or live credentials in the output', async () => {
    const files = await loadFiles()
    const sql = generateBootstrapSql(files)
    const header = sql.slice(0, sql.indexOf('-- 0001_motion_core.sql'))
    expect(header).not.toContain('DATABASE_URL')
    expect(header).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(header).not.toContain('OWNER_ALLOWED_EMAILS')
    expect(sql).not.toContain('DATABASE_URL')
    expect(sql).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(sql).not.toContain('postgresql://')
    expect(sql).not.toContain('postgres://')
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./)
    expect(sql).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
    const generator = await readFile(fileURLToPath(new URL('../scripts/generate-supabase-bootstrap.js', import.meta.url)), 'utf8')
    expect(generator).not.toContain('process.env')
    expect(generator).not.toContain('.env.supabase')
  })
})
