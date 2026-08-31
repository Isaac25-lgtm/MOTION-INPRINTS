import { describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { assertMigrationConnection, isPooledNeonUrl, resolveMigrationDatabaseUrl } from '../db/migration-connection.js'
import { checksum } from '../db/migration-checksum.js'
import { runMigrations } from '../db/run-migrations.js'

const neonDirect = 'postgresql://user:x@ep-example.us-east-1.aws.neon.tech:5432/neondb?sslmode=require'
const neonPooled = 'postgresql://user:x@ep-example-pooler.us-east-1.aws.neon.tech:5432/neondb?sslmode=require'
const neonPgBouncer = 'postgresql://user:x@ep-example.us-east-1.aws.neon.tech:5432/neondb?pgbouncer=true'
const neon6543 = 'postgresql://user:x@ep-example.us-east-1.aws.neon.tech:6543/neondb'
const localDirect = 'postgresql://motion:motion@127.0.0.1:5432/motion_test'
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
  it('accepts a direct Neon or local connection', () => {
    expect(() => assertMigrationConnection(neonDirect)).not.toThrow()
    expect(() => assertMigrationConnection(localDirect)).not.toThrow()
    expect(isPooledNeonUrl(neonDirect)).toBe(false)
  })

  it('refuses pooled Neon URLs because the runner uses a session advisory lock', () => {
    expect(isPooledNeonUrl(neonPooled)).toBe(true)
    expect(isPooledNeonUrl(neonPgBouncer)).toBe(true)
    expect(isPooledNeonUrl(neon6543)).toBe(true)
    expect(() => assertMigrationConnection(neonPooled)).toThrow(/unpooled|advisory lock|Pooled/)
    expect(() => assertMigrationConnection(neon6543)).toThrow(/6543/)
  })

  it('prefers MIGRATION_DATABASE_URL and falls back only to direct localhost', () => {
    expect(resolveMigrationDatabaseUrl({ MIGRATION_DATABASE_URL: neonDirect, DATABASE_URL: neonPooled })).toBe(neonDirect)
    expect(resolveMigrationDatabaseUrl({ DATABASE_URL: localDirect })).toBe(localDirect)
    expect(() => resolveMigrationDatabaseUrl({ DATABASE_URL: neonDirect })).toThrow(/localhost|MIGRATION_DATABASE_URL/)
    expect(() => resolveMigrationDatabaseUrl({ DATABASE_URL: neonPooled }))
      .toThrow(/MIGRATION_DATABASE_URL/)
    expect(() => resolveMigrationDatabaseUrl({ MIGRATION_DATABASE_URL: neonPooled }))
      .toThrow(/unpooled|advisory lock|Pooled/)
  })
})

describe('migration runner design', () => {
  it('still uses one Client and an advisory lock', async () => {
    const source = await readFile(fileURLToPath(new URL('../db/migrate.js', import.meta.url)), 'utf8')
    const runner = await readFile(fileURLToPath(new URL('../db/run-migrations.js', import.meta.url)), 'utf8')
    expect(source).toContain('new pg.Client')
    expect(source).toContain('resolveMigrationDatabaseUrl')
    expect(runner).toContain("pg_advisory_lock(hashtext('motion_schema_migrations'))")
    expect(source).not.toMatch(/new pg\.Pool/)
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

describe('migration files', () => {
  it('includes 0015 after the immutable 0001–0014 chain', async () => {
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
      '0015_neon_guest_admin.sql',
      '0016_neon_runtime_role.sql',
    ])
  })

  it('creates guest contacts and administrator sessions without dropping historical columns', async () => {
    const sql = await readFile(new URL('0015_neon_guest_admin.sql', migrationDir), 'utf8')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.customer_contacts')
    expect(sql).toContain('customer_contacts_normalized_email_uidx')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS contact_id')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_sessions')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_login_attempts')
    expect(sql).toMatch(/DISABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/Not accounts/)
    expect(sql).not.toMatch(/DROP TABLE public\.user_profiles/)
    expect(sql).not.toMatch(/DROP COLUMN.*customer_id/)
  })

  it('creates a DML-only Neon runtime role', async () => {
    const sql = await readFile(new URL('0016_neon_runtime_role.sql', migrationDir), 'utf8')
    expect(sql).toContain('CREATE ROLE motion_app LOGIN NOINHERIT')
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO motion_app')
    expect(sql).toContain('REVOKE CREATE ON SCHEMA public FROM PUBLIC')
  })
})
