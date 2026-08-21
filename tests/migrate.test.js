import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { assertMigrationConnection } from '../db/migration-connection.js'

const direct = 'postgresql://postgres:x@db.example.supabase.co:5432/postgres'
const session = 'postgresql://postgres.example:x@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
const transaction = 'postgresql://postgres.example:x@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'

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
    expect(source).toContain('new pg.Client')
    expect(source).toContain("pg_advisory_lock(hashtext('motion_schema_migrations'))")
    expect(source).not.toMatch(/new pg\.Pool/)
    expect(source).toContain('assertMigrationConnection')
  })
})
