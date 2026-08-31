import { describe, expect, it } from 'vitest'
import { LOGIN_FAILURE_MESSAGE, hashPassword } from '../server/admins.js'
import {
  createAdminSession,
  createSessionToken,
  hashToken,
  hashUsername,
  pruneAuthState,
  restoreSession,
  revokeSession,
  sessionHoursFrom,
} from '../server/sessions.js'
import { FAKE_ADMIN_ID } from './helpers/env.js'

function memoryAuthDb() {
  const sessions = []
  const attempts = new Map()
  return {
    sessions,
    attempts,
    query: async (sql, values = []) => {
      const statement = sql.replace(/\s+/g, ' ')
      if (statement.includes('DELETE FROM public.admin_sessions')) {
        for (let i = sessions.length - 1; i >= 0; i -= 1) {
          const row = sessions[i]
          if (new Date(row.expires_at) < new Date(values[0]) || (row.revoked_at && new Date(row.revoked_at) < new Date(values[1]))) {
            sessions.splice(i, 1)
          }
        }
        return []
      }
      if (statement.includes('DELETE FROM public.admin_login_attempts WHERE (locked_until')) return []
      if (statement.includes('SELECT username_hash, failed_count, locked_until')
        || statement.includes('SELECT failed_count, locked_until')) {
        const row = attempts.get(values[0])
        return row ? [row] : []
      }
      if (statement.includes('INSERT INTO public.admin_login_attempts')) {
        const current = attempts.get(values[0])
        const timestamp = values[1]
        const reset = !current
          || new Date(current.last_failed_at) < new Date(values[2])
          || (current.locked_until && new Date(current.locked_until) <= new Date(timestamp))
        const failedCount = reset ? 1 : current.failed_count + 1
        attempts.set(values[0], {
          username_hash: values[0],
          failed_count: failedCount,
          first_failed_at: reset ? timestamp : current.first_failed_at,
          last_failed_at: timestamp,
          locked_until: failedCount >= 5 ? values[3] : null,
        })
        return []
      }
      if (statement.includes('DELETE FROM public.admin_login_attempts WHERE username_hash')) {
        attempts.delete(values[0])
        return []
      }
      if (statement.includes('INSERT INTO public.admin_sessions')) {
        sessions.push({
          id: `sess-${sessions.length + 1}`,
          administrator_id: values[0],
          username: values[1],
          token_hash: values[2],
          created_at: values[3],
          expires_at: values[4],
          last_seen_at: values[3],
          revoked_at: null,
        })
        return []
      }
      if (statement.includes('SELECT id, administrator_id, username, expires_at, revoked_at')) {
        return sessions.filter((row) => row.token_hash === values[0])
      }
      if (statement.includes('UPDATE public.admin_sessions SET last_seen_at')) {
        const row = sessions.find((entry) => entry.id === values[1])
        if (row) row.last_seen_at = values[0]
        return []
      }
      if (statement.includes('UPDATE public.admin_sessions SET revoked_at')) {
        for (const row of sessions) {
          if (row.token_hash === values[1] && !row.revoked_at) row.revoked_at = values[0]
        }
        return []
      }
      return []
    },
  }
}

describe('session tokens', () => {
  it('issues at least 256 bits of randomness and stores only the SHA-256 hash', () => {
    const token = createSessionToken()
    expect(token.length).toBeGreaterThanOrEqual(43)
    const digest = hashToken(token)
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect(digest).not.toBe(token)
    const other = createSessionToken()
    expect(other).not.toBe(token)
  })

  it('hashes usernames before storing attempt state', () => {
    expect(hashUsername('Ada')).toBe(hashToken('ada'))
    expect(hashUsername('Ada')).not.toBe('ada')
  })

  it('defaults session length to eight hours', () => {
    expect(sessionHoursFrom(undefined)).toBe(8)
    expect(sessionHoursFrom('12')).toBe(12)
    expect(sessionHoursFrom('0')).toBe(8)
  })
})

describe('session issuance, restoration and revocation', () => {
  it('issues a session for a valid password and restores it', async () => {
    const passwordHash = await hashPassword('correct-horse')
    const db = memoryAuthDb()
    const admins = [{ id: FAKE_ADMIN_ID, username: 'ada', passwordHash }]
    const issued = await createAdminSession(db, { username: 'Ada', password: 'correct-horse', admins })
    expect(issued.administrator).toEqual({ id: FAKE_ADMIN_ID, username: 'ada', role: 'owner' })
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43,}$/)
    expect(db.sessions[0].token_hash).toBe(hashToken(issued.token))
    expect(JSON.stringify(db.sessions)).not.toContain(issued.token)

    const actor = await restoreSession(db, issued.token, { admins })
    expect(actor).toMatchObject({ actorId: FAKE_ADMIN_ID, username: 'ada', role: 'owner' })
  })

  it('returns the same message for unknown usernames and wrong passwords', async () => {
    const passwordHash = await hashPassword('correct-horse')
    const db = memoryAuthDb()
    const admins = [{ id: FAKE_ADMIN_ID, username: 'ada', passwordHash }]
    await expect(createAdminSession(db, { username: 'nobody', password: 'correct-horse', admins }))
      .rejects.toMatchObject({ status: 401, message: LOGIN_FAILURE_MESSAGE })
    await expect(createAdminSession(db, { username: 'ada', password: 'nope', admins }))
      .rejects.toMatchObject({ status: 401, message: LOGIN_FAILURE_MESSAGE })
    expect(db.attempts.size).toBe(2)
  })

  it('locks after repeated failures for known and unknown usernames alike', async () => {
    const passwordHash = await hashPassword('correct-horse')
    const db = memoryAuthDb()
    const admins = [{ id: FAKE_ADMIN_ID, username: 'ada', passwordHash }]
    for (let i = 0; i < 5; i += 1) {
      await createAdminSession(db, { username: 'ghost', password: 'x', admins }).catch(() => {})
    }
    await expect(createAdminSession(db, { username: 'ghost', password: 'x', admins }))
      .rejects.toMatchObject({ status: 401, message: LOGIN_FAILURE_MESSAGE })
    const attempt = [...db.attempts.values()][0]
    expect(attempt.failed_count).toBe(5)
    expect(attempt.locked_until).toBeTruthy()
  })

  it('starts a fresh failure window after an expired lock', async () => {
    const passwordHash = await hashPassword('correct-horse')
    const db = memoryAuthDb()
    const admins = [{ id: FAKE_ADMIN_ID, username: 'ada', passwordHash }]
    const started = new Date('2026-01-01T00:00:00.000Z')
    for (let i = 0; i < 5; i += 1) {
      await createAdminSession(db, { username: 'ada', password: 'wrong', admins, now: started }).catch(() => {})
    }
    await createAdminSession(db, {
      username: 'ada', password: 'wrong', admins, now: new Date('2026-01-01T00:16:00.000Z'),
    }).catch(() => {})
    const attempt = [...db.attempts.values()][0]
    expect(attempt.failed_count).toBe(1)
    expect(attempt.locked_until).toBeNull()
  })

  it('rejects expired and revoked sessions', async () => {
    const passwordHash = await hashPassword('correct-horse')
    const db = memoryAuthDb()
    const admins = [{ id: FAKE_ADMIN_ID, username: 'ada', passwordHash }]
    const issued = await createAdminSession(db, { username: 'ada', password: 'correct-horse', admins, sessionHours: 1 })
    db.sessions[0].expires_at = new Date(Date.now() - 1000).toISOString()
    await expect(restoreSession(db, issued.token, { admins })).rejects.toMatchObject({ status: 401, code: 'invalid_session' })

    const fresh = await createAdminSession(db, { username: 'ada', password: 'correct-horse', admins })
    await revokeSession(db, fresh.token)
    await expect(restoreSession(db, fresh.token, { admins })).rejects.toMatchObject({ status: 401, code: 'invalid_session' })
  })

  it('prunes expired sessions', async () => {
    const db = memoryAuthDb()
    db.sessions.push({
      id: 'old',
      expires_at: new Date(Date.now() - 1000).toISOString(),
      revoked_at: null,
    })
    await pruneAuthState(db, new Date())
    expect(db.sessions).toHaveLength(0)
  })
})
