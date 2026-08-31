import { describe, expect, it } from 'vitest'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/* Secrets must not ship in the browser. DATABASE_URL, administrator hashes,
 * and migration credentials are server-only. */

const root = fileURLToPath(new URL('..', import.meta.url))

const walk = async (dir, files = []) => {
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return files }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      await walk(path, files)
    } else {
      files.push(path)
    }
  }
  return files
}

const FORBIDDEN = [
  'DATABASE_URL',
  'MIGRATION_DATABASE_URL',
  'ADMIN_USERS_JSON',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OWNER_ALLOWED_EMAILS',
]

describe('no server secrets in the frontend source', () => {
  it('does not mention the service-role key or database URL in src/', async () => {
    const files = (await walk(join(root, 'src'))).filter((path) => /\.(jsx?|css|html)$/.test(path))
    expect(files.length).toBeGreaterThan(10)
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const needle of FORBIDDEN) {
        expect(source, `${file} must not contain ${needle}`).not.toContain(needle)
      }
      expect(source, `${file} must not import neon-js`).not.toContain('@neondatabase')
    }
  })

  it('does not mention them in the production bundle when dist/ exists', async () => {
    const dist = join(root, 'dist')
    try { await stat(dist) } catch { return }
    const files = (await walk(dist)).filter((path) => /\.(js|css|html|map)$/.test(path))
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      expect(source, `${file} must not contain DATABASE_URL`).not.toContain('DATABASE_URL')
      expect(source, `${file} must not contain MIGRATION_DATABASE_URL`).not.toContain('MIGRATION_DATABASE_URL')
      expect(source, `${file} must not contain ADMIN_USERS_JSON`).not.toContain('ADMIN_USERS_JSON')
      expect(source).not.toMatch(/scrypt\$\d+\$/)
      expect(source).not.toMatch(/["']service_role["']\s*:/)
    }
  })
})

describe('row-level security is historical, then disabled on Neon', () => {
  it('keeps 0014 as an immutable applied migration', async () => {
    const sql = await readFile(join(root, 'db/migrations/0014_supabase_rls_and_storage.sql'), 'utf8')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(sql).not.toMatch(/FORCE ROW LEVEL SECURITY/)
  })

  it('disables that RLS configuration in 0015 because there is no Data API', async () => {
    const sql = await readFile(join(root, 'db/migrations/0015_neon_guest_admin.sql'), 'utf8')
    expect(sql).toMatch(/DISABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/no PostgREST|Motion API/i)
  })
})
