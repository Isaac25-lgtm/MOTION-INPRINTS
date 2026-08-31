import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export const SCRYPT = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 64, saltBytes: 16 })
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const LOGIN_FAILURE_MESSAGE = 'Those details do not match a Motion staff account.'

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

export function encodeScryptHash(key, salt, params = SCRYPT) {
  return `scrypt$${params.N}$${params.r}$${params.p}$${params.keylen}$${Buffer.from(salt).toString('hex')}$${Buffer.from(key).toString('hex')}`
}

export function parseScryptHash(encoded) {
  const parts = String(encoded || '').split('$')
  if (parts.length !== 7 || parts[0] !== 'scrypt') {
    throw new Error('Password hashes must use the scrypt$N$r$p$keylen$salt$hash encoding.')
  }
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const keylen = Number(parts[4])
  if (![N, r, p, keylen].every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error('Password hashes must use the scrypt$N$r$p$keylen$salt$hash encoding.')
  }
  const salt = Buffer.from(parts[5], 'hex')
  const hash = Buffer.from(parts[6], 'hex')
  if (!salt.length || hash.length !== keylen) {
    throw new Error('Password hashes must use the scrypt$N$r$p$keylen$salt$hash encoding.')
  }
  return { N, r, p, keylen, salt, hash }
}

export async function hashPassword(password, params = SCRYPT) {
  const salt = randomBytes(params.saltBytes)
  const key = await scrypt(String(password), salt, params.keylen, { N: params.N, r: params.r, p: params.p })
  return encodeScryptHash(key, salt, params)
}

export async function verifyPassword(password, encoded) {
  const parsed = parseScryptHash(encoded)
  const key = await scrypt(String(password), parsed.salt, parsed.keylen, { N: parsed.N, r: parsed.r, p: parsed.p })
  if (key.length !== parsed.hash.length) return false
  return timingSafeEqual(key, parsed.hash)
}

let dummyHashPromise = null
function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword('motion-unknown-username')
  return dummyHashPromise
}

/** Runs a real scrypt even when the username is unknown, so timing does not leak existence. */
export async function dummyVerify(password) {
  await verifyPassword(password, await dummyHash())
}

export function parseAdminUsers(json, { required = false } = {}) {
  const raw = String(json ?? '').trim()
  if (!raw) {
    if (required) throw new Error('ADMIN_USERS_JSON is required in production and must list at least one administrator.')
    return []
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('ADMIN_USERS_JSON must be valid JSON.')
  }
  if (!Array.isArray(parsed) || parsed.length < 1) {
    throw new Error('ADMIN_USERS_JSON must be a non-empty array of administrators.')
  }

  const users = parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`ADMIN_USERS_JSON[${index}] must be an object.`)
    }
    const id = String(entry.id || '').trim()
    const username = normalizeUsername(entry.username)
    const passwordHash = String(entry.passwordHash || '').trim()
    if (!UUID_RE.test(id)) throw new Error(`ADMIN_USERS_JSON[${index}] needs a valid UUID id.`)
    if (!username || username.length > 80) throw new Error(`ADMIN_USERS_JSON[${index}] needs a unique username.`)
    parseScryptHash(passwordHash)
    if (Object.prototype.hasOwnProperty.call(entry, 'password')) {
      throw new Error('ADMIN_USERS_JSON must contain passwordHash values, never plaintext passwords.')
    }
    return { id: id.toLowerCase(), username, passwordHash }
  })

  const ids = new Set()
  const names = new Set()
  for (const user of users) {
    if (ids.has(user.id)) throw new Error('ADMIN_USERS_JSON administrator ids must be unique.')
    if (names.has(user.username)) throw new Error('ADMIN_USERS_JSON usernames must be unique.')
    ids.add(user.id)
    names.add(user.username)
  }
  return users
}

export function findAdminByUsername(admins, username) {
  const normalized = normalizeUsername(username)
  return admins.find((admin) => admin.username === normalized) || null
}

export function findAdminById(admins, id) {
  const value = String(id || '').toLowerCase()
  return admins.find((admin) => admin.id === value) || null
}
