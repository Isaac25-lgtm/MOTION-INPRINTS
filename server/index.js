import { createApi } from './api.js'
import { createAuthenticator } from './auth.js'
import { serverConfig } from './config.js'
import { createDatabase } from './db.js'
import { createHttpHandler } from './handler.js'
import { createStorageAdapter } from './storage.js'

const config = serverConfig()
const db = createDatabase(config)
const api = createApi({ db, storage: createStorageAdapter(config.storage), authenticate: createAuthenticator({ jwksUrl: config.authJwksUrl, issuer: config.authIssuer, db }) })
export default createHttpHandler(api, config)
