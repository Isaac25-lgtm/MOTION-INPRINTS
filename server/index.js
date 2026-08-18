import { createApi } from './api.js'
import { createAuthenticator } from './auth.js'
import { serverConfig } from './config.js'
import { createDatabase } from './db.js'
import { createClientKeyResolver, createHttpHandler } from './handler.js'
import { createStorageAdapter } from './storage.js'

const config = serverConfig()
const db = createDatabase(config)
const api = createApi({
  db,
  storage: createStorageAdapter(config.storage),
  mediaBaseUrl: config.storage.publicBaseUrl,
  authenticate: createAuthenticator({ jwksUrl: config.authJwksUrl, issuer: config.authIssuer, db }),
  // Server-only allowlist. Never reaches the browser.
  ownerAllowedEmails: config.ownerAllowedEmails,
})
export default createHttpHandler(api, config, { getClientKey: createClientKeyResolver(config) })
