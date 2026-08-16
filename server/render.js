#!/usr/bin/env node
/* Node HTTP bridge for the Fetch-style API handler.
 *
 * `server/index.js` exports a handler of the shape `(Request) => Response`,
 * which is what a fetch-native runtime wants and what the tests exercise
 * directly. A Render Web Service instead needs a process listening on
 * `process.env.PORT`, so this translates between the two and does nothing else:
 * no routing, no middleware, no framework. Every rule about origins, rate
 * limiting, authentication and errors stays in the handler, where it is tested.
 *
 *     node server/render.js
 *     npm run start:api
 *
 * `server/dev.js` is unchanged and remains the local development entry point.
 *
 * Nothing here logs a header, a body, a query string or a connection string.
 * The Authorization header and DATABASE_URL both pass through this file, and a
 * request log that seemed harmless is the usual way either ends up on disk.
 */

import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import handler from './index.js'

const PORT = Number(process.env.PORT) || 8787
/* Render routes to the container's published port on all interfaces; binding
   loopback would make the service unreachable and fail its health check. */
const HOST = '0.0.0.0'

/* Bodies are JSON of modest size — artwork is transferred straight to object
   storage through a signed URL and never passes through here. Buffering rather
   than streaming keeps the conversion simple and avoids the half-duplex request
   handling that streaming a Node request into a Fetch Request requires. The cap
   stops a malformed or hostile request from growing without bound; the handler's
   own validation rejects anything smaller but wrong. */
const MAX_BODY_BYTES = 1_048_576

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

/** Node IncomingMessage -> Fetch Request. */
async function toFetchRequest(nodeRequest) {
  const proto = nodeRequest.headers['x-forwarded-proto'] || 'http'
  const host = nodeRequest.headers.host || `${HOST}:${PORT}`
  const url = new URL(nodeRequest.url, `${proto}://${host}`)

  const headers = new Headers()
  for (const [name, value] of Object.entries(nodeRequest.headers)) {
    if (value === undefined) continue
    // Node lowercases names and may hand back an array for repeated headers.
    if (Array.isArray(value)) for (const item of value) headers.append(name, item)
    else headers.set(name, value)
  }

  const method = nodeRequest.method || 'GET'
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const body = hasBody ? await readBody(nodeRequest) : undefined

  return new Request(url, {
    method,
    headers,
    body: body && body.length ? body : undefined,
  })
}

/** Fetch Response -> Node ServerResponse. */
async function writeResponse(response, nodeResponse) {
  const headers = {}
  response.headers.forEach((value, name) => { headers[name] = value })

  /* Set-Cookie is the one header that may legitimately repeat, and the loop
     above would collapse duplicates into the last one. */
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  if (cookies.length) {
    delete headers['set-cookie']
    nodeResponse.writeHead(response.status, { ...headers, 'set-cookie': cookies })
  } else {
    nodeResponse.writeHead(response.status, headers)
  }

  if (!response.body) { nodeResponse.end(); return }
  await new Promise((resolve, reject) => {
    Readable.fromWeb(response.body).pipe(nodeResponse).on('finish', resolve).on('error', reject)
  })
}

const json = (nodeResponse, status, payload) => {
  const body = JSON.stringify(payload)
  nodeResponse.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
  nodeResponse.end(body)
}

export function createRenderServer(apiHandler = handler) {
  return createServer(async (nodeRequest, nodeResponse) => {
    try {
      /* Health check, answered before the handler so it needs no database, no
         credential and no configured origin. Render polls this to decide whether
         the instance is live; routing it through the API would make a database
         hiccup look like a dead process and trigger a restart loop. It reports
         liveness only, and deliberately discloses nothing about configuration. */
      if (nodeRequest.url === '/healthz') { json(nodeResponse, 200, { status: 'ok' }); return }

      const response = await apiHandler(await toFetchRequest(nodeRequest))
      await writeResponse(response, nodeResponse)
    } catch (error) {
      if (nodeResponse.headersSent) { nodeResponse.destroy(); return }
      const status = error?.status === 413 ? 413 : 500
      /* The message is deliberately generic. The handler already converts its
         own failures into shaped API errors; anything reaching here is
         unexpected, and echoing it risks returning a stack trace or a
         connection string to the caller. */
      json(nodeResponse, status, {
        error: {
          code: status === 413 ? 'payload_too_large' : 'internal_error',
          message: status === 413 ? 'Request body is too large.' : 'The request could not be completed.',
        },
      })
    }
  })
}

/* Started only when run directly, so tests can import `createRenderServer` and
   bind an ephemeral port without this module seizing PORT as a side effect. */
const isEntryPoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href
if (isEntryPoint) {
  const server = createRenderServer()
  server.listen(PORT, HOST, () => {
    // Port and host only. Never the database, the auth issuer or any variable.
    console.log(`Motion API listening on ${HOST}:${PORT}`)
  })
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => { server.close(() => process.exit(0)) })
  }
}

export default createRenderServer
