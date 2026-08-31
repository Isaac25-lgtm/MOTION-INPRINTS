import { encodeScryptHash, SCRYPT } from '../../server/admins.js'

/** Shared fake environment for tests. Not real credentials. */
export const FAKE_DATABASE_URL = 'postgres://motion:motion@127.0.0.1:5432/motion_test'
export const FAKE_PASSWORD_HASH = encodeScryptHash(Buffer.alloc(SCRYPT.keylen), Buffer.alloc(SCRYPT.saltBytes))
export const FAKE_ADMIN_ID = '11111111-1111-4111-8111-111111111111'

export function adminUsersJson(entries) {
  return JSON.stringify(entries || [{
    id: FAKE_ADMIN_ID,
    username: 'ada',
    passwordHash: FAKE_PASSWORD_HASH,
  }])
}

export const serverEnv = {
  DATABASE_URL: FAKE_DATABASE_URL,
}

export const ownerActor = {
  actorId: FAKE_ADMIN_ID,
  username: 'ada',
  role: 'owner',
}
