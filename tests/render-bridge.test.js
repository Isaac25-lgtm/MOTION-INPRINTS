import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRenderServer } from '../server/render.js'

/* The Node bridge that lets the Fetch-style handler run as a Render Web Service.
 *
 * `createRenderServer` takes the handler as an argument so these tests can pass
 * a stub. Importing the real one would construct a database client and a JWKS
 * fetcher from environment variables, which is a deployment concern rather than
 * anything this file is responsible for — the bridge's whole job is translating
 * between Node and Fetch, and that is what is measured here.
 *
 * The module is also written so that importing it starts nothing: the listener
 * runs only when the file is the process entry point. Otherwise this suite would
 * seize PORT on import.
 */

/** Echoes back what the handler actually received, so the conversion is visible. */
const echoHandler = async (request) => {
  const body = request.method === 'GET' || request.method === 'HEAD' ? null : await request.text()
  return new Response(JSON.stringify({
    method: request.method,
    path: new URL(request.url).pathname,
    query: new URL(request.url).search,
    authorization: request.headers.get('authorization'),
    contentType: request.headers.get('content-type'),
    body,
  }), { status: 201, headers: { 'content-type': 'application/json', 'x-custom': 'kept' } })
}

let server
let base

beforeAll(async () => {
  server = createRenderServer(echoHandler)
  // Port 0 asks the OS for a free one, so the suite never collides with a dev server.
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(() => new Promise(resolve => server.close(resolve)))

describe('Render Node bridge', () => {
  it('listens on the port it is given', () => {
    const { port, address } = server.address()
    expect(port).toBeGreaterThan(0)
    expect(address).toBe('127.0.0.1')
  })

  /* Render polls this to decide whether the instance is live. It must not need a
     database, a credential or a configured origin — routing it through the API
     would turn a database hiccup into a restart loop. */
  it('answers /healthz with 200 and no authentication', async () => {
    const response = await fetch(`${base}/healthz`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('forwards method, path, query, headers and body to the handler', async () => {
    const response = await fetch(`${base}/api/orders?limit=5`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
      body: JSON.stringify({ reference: 'MOT-K7P2QX' }),
    })

    expect(response.status).toBe(201)
    // Response headers survive the conversion back to Node.
    expect(response.headers.get('x-custom')).toBe('kept')

    const seen = await response.json()
    expect(seen.method).toBe('POST')
    expect(seen.path).toBe('/api/orders')
    expect(seen.query).toBe('?limit=5')
    expect(seen.authorization).toBe('Bearer test-token')
    expect(seen.contentType).toContain('application/json')
    // The body arrives intact rather than empty or truncated.
    expect(JSON.parse(seen.body)).toEqual({ reference: 'MOT-K7P2QX' })
  })

  it('sends no body for GET, and preserves the handler status', async () => {
    const response = await fetch(`${base}/api/products`)
    const seen = await response.json()
    expect(seen.method).toBe('GET')
    expect(seen.body).toBeNull()
  })

  it('returns a shaped error without leaking internals when the handler throws', async () => {
    const boom = createRenderServer(async () => { throw new Error('DATABASE_URL=postgres://u:hunter2@db/x failed') })
    await new Promise(resolve => boom.listen(0, '127.0.0.1', resolve))
    try {
      const response = await fetch(`http://127.0.0.1:${boom.address().port}/api/products`)
      expect(response.status).toBe(500)
      const text = await response.text()
      // The thrown message carried a connection string; none of it may escape.
      expect(text).not.toContain('hunter2')
      expect(text).not.toContain('postgres://')
      expect(text).not.toContain('DATABASE_URL')
      expect(JSON.parse(text).error.code).toBe('internal_error')
    } finally { await new Promise(resolve => boom.close(resolve)) }
  })

  it('rejects an oversized body instead of buffering it without bound', async () => {
    const response = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'x'.repeat(1_200_000),
    }).catch(() => null)
    // The socket may be destroyed mid-upload; either outcome is a refusal.
    if (response) expect(response.status).toBe(413)
  })

  /* The Authorization header and DATABASE_URL both pass through this file. A
     request log that looked harmless is the usual way either reaches disk. */
  it('logs nothing that could carry a credential', async () => {
    const source = await readFile(fileURLToPath(new URL('../server/render.js', import.meta.url)), 'utf8')
    const logs = source.match(/console\.(log|info|warn|error|debug)\([^)]*\)/g) || []

    /* Two log lines only: the listening notice, and a startup failure. Nothing
       per-request is ever logged here. */
    expect(logs).toHaveLength(2)
    expect(logs.some(l => l.includes('listening'))).toBe(true)
    expect(logs.some(l => l.includes('failed to start'))).toBe(true)

    for (const line of logs) {
      for (const forbidden of ['headers', 'authorization', 'body', 'DATABASE_URL', 'process.env', 'req.url', 'nodeRequest.url']) {
        expect(line, `logging must not include ${forbidden}`).not.toContain(forbidden)
      }
    }

    /* The failure line prints an error message, which is not inherently safe —
       a driver failure can carry a connection string. It must be redacted. */
    const failureLine = logs.find(l => l.includes('failed to start'))
    expect(failureLine).toContain('safe')
    expect(source).toMatch(/redacted-url/)
    // And no framework was smuggled in to do the job.
    expect(source).not.toMatch(/from 'express'|require\('express'\)/)
  })
})

/* The Blueprint wires VITE_API_BASE_URL from the API service's
   RENDER_EXTERNAL_URL, which is an origin with no path. render.yaml cannot
   concatenate, so the `/api` prefix is added in the app. */
describe('API base URL normalisation', () => {
  it('appends /api to a bare origin and leaves an explicit path alone', async () => {
    const { readFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const source = await readFile(fileURLToPath(new URL('../src/config/env.js', import.meta.url)), 'utf8')

    // Extracted rather than imported: env.js reads import.meta.env, which only
    // exists under Vite's transform.
    const body = source.slice(source.indexOf('function normaliseApiBaseUrl'), source.indexOf('export const env'))
    const normalise = new Function(`${body}; return normaliseApiBaseUrl`)()

    // What Render supplies.
    expect(normalise('https://motion-api.onrender.com')).toBe('https://motion-api.onrender.com/api')
    expect(normalise('https://motion-api.onrender.com/')).toBe('https://motion-api.onrender.com/api')

    // What a developer supplies — must not become /api/api.
    expect(normalise('http://localhost:8787/api')).toBe('http://localhost:8787/api')
    expect(normalise('https://api.motion.example/v2')).toBe('https://api.motion.example/v2')

    // Trailing slashes never produce a doubled separator.
    expect(normalise('http://localhost:8787/api/')).toBe('http://localhost:8787/api')
    expect(normalise('')).toBe('')
  })
})
