import { createApi } from './api.js'
import { createAuthenticator } from './auth.js'
import { serverConfig } from './config.js'
import { createDatabase } from './db.js'
import { createClientKeyResolver, createHttpHandler } from './handler.js'
import { createStorageAdapter } from './storage.js'
import { createSupabaseAdmin } from './supabase.js'

const config = serverConfig()
const db = createDatabase(config)
const supabase = createSupabaseAdmin(config)
const api = createApi({
  db,
  storage: createStorageAdapter({ supabase, publicBaseUrl: config.storage.publicBaseUrl }),
  mediaBaseUrl: config.storage.publicBaseUrl,
  authenticate: createAuthenticator({ supabase, db }),
  // Server-only allowlist. Never reaches the browser.
  ownerAllowedEmails: config.ownerAllowedEmails,
  ownersConfigured: config.ownersConfigured,
})
export default createHttpHandler(api, config, { getClientKey: createClientKeyResolver(config) })
