import { describe, expect, it } from 'vitest'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/* Secrets must not ship in the browser. The publishable key is allowed in
 * VITE_ variables; DATABASE_URL and the service_role key are not. */

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
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
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
      expect(source, `${file} must not contain SUPABASE_SERVICE_ROLE_KEY`).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
      expect(source, `${file} must not contain DATABASE_URL`).not.toContain('DATABASE_URL')
      expect(source).not.toMatch(/["']service_role["']\s*:/)
    }
  })
})

describe('row-level security is defense in depth', () => {
  it('enables RLS without FORCE so the Node API remains the authority', async () => {
    const sql = await readFile(join(root, 'db/migrations/0014_supabase_rls_and_storage.sql'), 'utf8')
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(sql).not.toMatch(/FORCE ROW LEVEL SECURITY/)
    expect(sql).toContain('motion-private')
    expect(sql).toContain('motion-public')
    expect(sql).toMatch(/REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon/)
  })
})
