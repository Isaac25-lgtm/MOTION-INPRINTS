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
  storage: createStorageAdapter({ publicBaseUrl: config.storage.publicBaseUrl }),
  mediaBaseUrl: config.storage.publicBaseUrl,
  authenticate: createAuthenticator({ db, admins: config.admins }),
  admins: config.admins,
  adminSessionHours: config.adminSessionHours,
})
export default createHttpHandler(api, config, { getClientKey: createClientKeyResolver(config) })
