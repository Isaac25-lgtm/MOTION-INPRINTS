import pg from 'pg'
import { serverConfig } from './config.js'

/* Postgres access for the Render API and local development.
 *
 * Runtime traffic uses DATABASE_URL (Neon pooled). Migrations use
 * MIGRATION_DATABASE_URL (direct, unpooled). The query surface is unchanged:
 * `query(sql, params)` returns rows, and `transaction(build)` runs a batch of
 * statements atomically at SERIALIZABLE isolation.
 *
 * TLS is required for hosted Neon URLs. Channel binding is requested when the
 * URL already carries it; we do not rewrite connection strings. */

export function sslFor(connectionString) {
  const url = String(connectionString || '')
  if (/sslmode=disable/i.test(url)) return false
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const local = host === 'localhost' || host === '127.0.0.1' || host === '::1'
    if (local && !/sslmode=require/i.test(url)) return false
    if (host.endsWith('.neon.tech') || /sslmode=require/i.test(url)) {
      return { rejectUnauthorized: true }
    }
  } catch {
    /* Fall through. */
  }
  if (/sslmode=require/i.test(url) || /\.neon\.tech/i.test(url)) {
    return { rejectUnauthorized: true }
  }
  return false
}

export function createPool(connectionString, options = {}) {
  return new pg.Pool({
    connectionString,
    ssl: sslFor(connectionString),
    max: options.max ?? 10,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 10_000,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
    allowExitOnIdle: options.allowExitOnIdle ?? true,
  })
}

/**
 * Database client used by the API.
 *
 * Queries inside a transaction are serialised on one connection so a later
 * statement can be queued before an earlier one has returned — matching the
 * non-interactive batch the handlers already build (order + items + history
 * in one shot, with ids generated in the application).
 */
export function createDatabaseClient(pool) {
  return {
    query: async (statement, parameters = []) => (await pool.query(statement, parameters)).rows,
    transaction: async (build) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
        let queue = Promise.resolve()
        const tx = {
          query: (statement, parameters = []) => {
            const operation = queue.then(async () => (await client.query(statement, parameters)).rows)
            queue = operation.catch(() => {})
            return operation
          },
        }
        const results = await Promise.all(build(tx))
        await client.query('COMMIT')
        return results
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },
    end: () => pool.end(),
  }
}

export function createDatabase(config = serverConfig()) {
  return createDatabaseClient(createPool(config.databaseUrl))
}
