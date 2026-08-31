import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  dummyVerify,
  encodeScryptHash,
  findAdminByUsername,
  hashPassword,
  LOGIN_FAILURE_MESSAGE,
  normalizeUsername,
  parseAdminUsers,
  parseScryptHash,
  SCRYPT,
  verifyPassword,
} from '../server/admins.js'
import { FAKE_ADMIN_ID, FAKE_PASSWORD_HASH } from './helpers/env.js'

describe('administrator credential parsing', () => {
  it('normalizes usernames consistently', () => {
    expect(normalizeUsername(' Ada ')).toBe('ada')
    expect(normalizeUsername('ADA')).toBe('ada')
  })

  it('accepts one or more distinct administrators', () => {
    const users = parseAdminUsers(JSON.stringify([
      { id: FAKE_ADMIN_ID, username: 'Ada', passwordHash: FAKE_PASSWORD_HASH },
      { id: '22222222-2222-4222-8222-222222222222', username: 'ben', passwordHash: FAKE_PASSWORD_HASH },
    ]))
    expect(users).toHaveLength(2)
    expect(users[0].username).toBe('ada')
    expect(findAdminByUsername(users, 'ADA').id).toBe(FAKE_ADMIN_ID)
  })

  it('rejects duplicate usernames and duplicate UUIDs', () => {
    const duplicateName = JSON.stringify([
      { id: FAKE_ADMIN_ID, username: 'ada', passwordHash: FAKE_PASSWORD_HASH },
      { id: '22222222-2222-4222-8222-222222222222', username: 'ADA', passwordHash: FAKE_PASSWORD_HASH },
    ])
    expect(() => parseAdminUsers(duplicateName)).toThrow(/usernames must be unique/)

    const duplicateId = JSON.stringify([
      { id: FAKE_ADMIN_ID, username: 'ada', passwordHash: FAKE_PASSWORD_HASH },
      { id: FAKE_ADMIN_ID, username: 'ben', passwordHash: FAKE_PASSWORD_HASH },
    ])
    expect(() => parseAdminUsers(duplicateId)).toThrow(/ids must be unique/)
  })

  it('rejects plaintext passwords and malformed hashes', () => {
    expect(() => parseAdminUsers(JSON.stringify([
      { id: FAKE_ADMIN_ID, username: 'ada', password: 'secret', passwordHash: FAKE_PASSWORD_HASH },
    ]))).toThrow(/never plaintext/)
    expect(() => parseAdminUsers(JSON.stringify([
      { id: FAKE_ADMIN_ID, username: 'ada', passwordHash: 'not-scrypt' },
    ]))).toThrow(/scrypt/)
  })

  it('is optional outside production and required when asked', () => {
    expect(parseAdminUsers('', { required: false })).toEqual([])
    expect(() => parseAdminUsers('', { required: true })).toThrow(/required in production/)
    expect(() => parseAdminUsers('[]', { required: true })).toThrow(/non-empty array/)
  })
})

describe('scrypt password verification', () => {
  it('round-trips a password with timingSafeEqual', async () => {
    const encoded = await hashPassword('correct-horse')
    expect(encoded.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('correct-horse', encoded)).toBe(true)
    expect(await verifyPassword('wrong-horse', encoded)).toBe(false)
  })

  it('parses the encoded form', () => {
    const parsed = parseScryptHash(FAKE_PASSWORD_HASH)
    expect(parsed).toMatchObject({ N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, keylen: SCRYPT.keylen })
    expect(encodeScryptHash(parsed.hash, parsed.salt, parsed)).toBe(FAKE_PASSWORD_HASH)
  })

  it('runs a dummy scrypt for unknown usernames', async () => {
    await expect(dummyVerify('any-password')).resolves.toBeUndefined()
  })
})

describe('hash-admin-password script', () => {
  it('refuses a password passed as a command-line argument', async () => {
    const script = fileURLToPath(new URL('../scripts/hash-admin-password.js', import.meta.url))
    const child = spawn(process.execPath, [script, 'this-must-not-be-accepted'], { stdio: ['ignore', 'pipe', 'pipe'] })
    const stderr = await new Promise((resolve) => {
      let out = ''
      child.stderr.on('data', (chunk) => { out += chunk })
      child.on('close', () => resolve(out))
    })
    expect(child.exitCode).not.toBe(0)
    expect(stderr).toMatch(/command-line argument/)
    expect(stderr).not.toContain('this-must-not-be-accepted')
  })
})

describe('neutral login copy', () => {
  it('does not distinguish unknown usernames from wrong passwords', () => {
    expect(LOGIN_FAILURE_MESSAGE).toBe('Those details do not match a Motion staff account.')
  })
})
