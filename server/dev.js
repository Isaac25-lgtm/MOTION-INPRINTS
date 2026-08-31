import { createServer } from 'node:http'
import { createApi } from './api.js'
import { createAuthenticator } from './auth.js'
import { serverConfig } from './config.js'
import { createDatabase } from './db.js'
import { createClientKeyResolver, createHttpHandler } from './handler.js'
import { createStorageAdapter } from './storage.js'

const port = Number(process.env.API_PORT || 8787)
const config = serverConfig()
const db = createDatabase(config)

const api = createApi({
  db,
  storage: createStorageAdapter({ publicBaseUrl: config.storage.publicBaseUrl }),
  mediaBaseUrl: config.storage.publicBaseUrl,
  authenticate: createAuthenticator({ db, admins: config.admins }),
  admins: config.admins,
  adminSessionHours: config.adminSessionHours,
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
