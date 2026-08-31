import { createHash, randomBytes } from 'node:crypto'
import { ApiError } from './http.js'
import {
  LOGIN_FAILURE_MESSAGE,
  dummyVerify,
  findAdminById,
  findAdminByUsername,
  normalizeUsername,
  verifyPassword,
} from './admins.js'

const DEFAULT_SESSION_HOURS = 8
const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const ATTEMPT_STALE_MS = 24 * 60 * 60 * 1000

export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex')
export const hashUsername = (username) => hashToken(normalizeUsername(username))
export const createSessionToken = () => randomBytes(32).toString('base64url')

export function sessionHoursFrom(value) {
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) return DEFAULT_SESSION_HOURS
  return hours
}

export async function pruneAuthState(db, now = new Date()) {
  const iso = now.toISOString()
  const stale = new Date(now.getTime() - ATTEMPT_STALE_MS).toISOString()
  await Promise.all([
    db.query('DELETE FROM public.admin_sessions WHERE expires_at < $1 OR (revoked_at IS NOT NULL AND revoked_at < $2)', [iso, stale]),
    db.query(
      'DELETE FROM public.admin_login_attempts WHERE (locked_until IS NULL OR locked_until < $1) AND last_failed_at < $2',
      [iso, stale],
    ),
  ])
}

async function loadAttempts(db, usernameHash) {
  const [row] = await db.query(
    'SELECT username_hash, failed_count, locked_until FROM public.admin_login_attempts WHERE username_hash=$1',
    [usernameHash],
  )
  return row || null
}

function isLocked(row, now = new Date()) {
  if (!row?.locked_until) return false
  return new Date(row.locked_until) > now
}

async function recordFailure(db, usernameHash, now = new Date()) {
  const timestamp = now.toISOString()
  const windowStart = new Date(now.getTime() - ATTEMPT_WINDOW_MS).toISOString()
  const lockUntil = new Date(now.getTime() + LOCK_MS).toISOString()
  const nextCount = `CASE
    WHEN public.admin_login_attempts.last_failed_at < $3
      OR (public.admin_login_attempts.locked_until IS NOT NULL AND public.admin_login_attempts.locked_until <= $2)
    THEN 1
    ELSE public.admin_login_attempts.failed_count + 1
  END`
  await db.query(
    `INSERT INTO public.admin_login_attempts(username_hash, failed_count, first_failed_at, last_failed_at, locked_until)
     VALUES ($1,1,$2,$2,NULL)
     ON CONFLICT (username_hash) DO UPDATE
       SET failed_count = ${nextCount},
           first_failed_at = CASE
             WHEN public.admin_login_attempts.last_failed_at < $3
               OR (public.admin_login_attempts.locked_until IS NOT NULL AND public.admin_login_attempts.locked_until <= $2)
             THEN EXCLUDED.first_failed_at
             ELSE public.admin_login_attempts.first_failed_at
           END,
           last_failed_at = EXCLUDED.last_failed_at,
           locked_until = CASE WHEN (${nextCount}) >= ${MAX_FAILURES} THEN $4::timestamptz ELSE NULL END
     RETURNING failed_count, locked_until`,
    [usernameHash, timestamp, windowStart, lockUntil],
  )
}

async function clearFailures(db, usernameHash) {
  await db.query('DELETE FROM public.admin_login_attempts WHERE username_hash=$1', [usernameHash])
}

function refuse() {
  throw new ApiError(401, 'invalid_credentials', LOGIN_FAILURE_MESSAGE)
}

export async function createAdminSession(db, { username, password, admins, sessionHours = DEFAULT_SESSION_HOURS, now = new Date() }) {
  const normalized = normalizeUsername(username)
  const usernameHash = hashUsername(normalized)
  await pruneAuthState(db, now)

  const attempts = await loadAttempts(db, usernameHash)
  const locked = isLocked(attempts, now)
  const admin = findAdminByUsername(admins, normalized)

  if (locked) {
    await dummyVerify(password)
    refuse()
  }

  if (!admin) {
    await dummyVerify(password)
    await recordFailure(db, usernameHash, now)
    refuse()
  }

  const matched = await verifyPassword(password, admin.passwordHash)
  if (!matched) {
    await recordFailure(db, usernameHash, now)
    refuse()
  }

  await clearFailures(db, usernameHash)
  const token = createSessionToken()
  const expiresAt = new Date(now.getTime() + sessionHours * 60 * 60 * 1000)
  await db.query(
    `INSERT INTO public.admin_sessions(administrator_id, username, token_hash, created_at, expires_at, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$4)`,
    [admin.id, admin.username, hashToken(token), now.toISOString(), expiresAt.toISOString()],
  )
  return {
    administrator: { id: admin.id, username: admin.username, role: 'owner' },
    token,
    expiresAt: expiresAt.toISOString(),
  }
}

export async function restoreSession(db, token, { admins = null, now = new Date() } = {}) {
  if (!token) return null
  await pruneAuthState(db, now)
  const digest = hashToken(token)
  const [row] = await db.query(
    `SELECT id, administrator_id, username, expires_at, revoked_at
     FROM public.admin_sessions
     WHERE token_hash=$1`,
    [digest],
  )
  if (!row || row.revoked_at || new Date(row.expires_at) <= now) {
    throw new ApiError(401, 'invalid_session', 'Your session is invalid or has expired.')
  }
  if (admins) {
    const admin = findAdminById(admins, row.administrator_id)
    if (!admin) throw new ApiError(401, 'invalid_session', 'Your session is invalid or has expired.')
  }
  await db.query('UPDATE public.admin_sessions SET last_seen_at=$1 WHERE id=$2', [now.toISOString(), row.id])
  return {
    actorId: row.administrator_id,
    username: row.username,
    role: 'owner',
    sessionId: row.id,
    expiresAt: row.expires_at,
  }
}

export async function revokeSession(db, token, now = new Date()) {
  if (!token) return { revoked: true }
  const digest = hashToken(token)
  await db.query(
    'UPDATE public.admin_sessions SET revoked_at=$1 WHERE token_hash=$2 AND revoked_at IS NULL',
    [now.toISOString(), digest],
  )
  return { revoked: true }
}

export function presentAdministrator(actor) {
  return { id: actor.actorId, username: actor.username, role: 'owner' }
}
