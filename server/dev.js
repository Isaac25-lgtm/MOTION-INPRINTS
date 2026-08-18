import { createServer } from 'node:http'
import pg from 'pg'
import { createApi } from './api.js'
import { createAuthenticator } from './auth.js'
import { serverConfig } from './config.js'
import { createClientKeyResolver, createHttpHandler } from './handler.js'
import { createStorageAdapter } from './storage.js'

const port = Number(process.env.API_PORT || 8787)
const config = serverConfig()
const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: /sslmode=require/.test(config.databaseUrl) ? { rejectUnauthorized: false } : false,
})

/* The deployed API uses Neon's HTTP driver. Local PostgreSQL needs the regular
   pg driver, so this adapter keeps development faithful without changing the
   production path. Queries within a transaction are deliberately serialized on
   one client, matching the non-interactive transaction contract used by Neon. */
const db = {
  query: async (statement, parameters = []) => (await pool.query(statement, parameters)).rows,
  transaction: async (build) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
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
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}

const api = createApi({
  db,
  storage: createStorageAdapter(config.storage),
  mediaBaseUrl: config.storage.publicBaseUrl,
  authenticate: createAuthenticator({ jwksUrl: config.authJwksUrl, issuer: config.authIssuer, db }),
  // Server-only allowlist. Never reaches the browser.
  ownerAllowedEmails: config.ownerAllowedEmails,
})
const apiHandler = createHttpHandler(api, config, { getClientKey: createClientKeyResolver(config) })

function toHeaders(headers) {
  const result = new Headers()
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    result.set(name, Array.isArray(value) ? value.join(', ') : value)
  }
  return result
}

const server = createServer(async (request, response) => {
  try {
    const origin = `http://${request.headers.host || `localhost:${port}`}`
    const method = request.method || 'GET'
    const body = ['GET', 'HEAD'].includes(method) ? undefined : request
    const webRequest = new Request(new URL(request.url || '/', origin), {
      method,
      headers: toHeaders(request.headers),
      body,
      duplex: body ? 'half' : undefined,
    })
    const webResponse = await apiHandler(webRequest)
    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()))
    if (!webResponse.body) return response.end()
    const bytes = Buffer.from(await webResponse.arrayBuffer())
    response.end(bytes)
  } catch (error) {
    console.error(error)
    response.writeHead(500, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'local_api_error', message: 'The local API could not process this request.' }))
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Motion local API listening at http://127.0.0.1:${port}/api`)
})
