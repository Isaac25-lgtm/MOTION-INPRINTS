/** Shared fake Supabase values for tests. Not real credentials. */

export function fakeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.test`
}

export const FAKE_SERVICE_ROLE_KEY = fakeJwt({ role: 'service_role', iss: 'supabase' })
export const FAKE_ANON_KEY = fakeJwt({ role: 'anon', iss: 'supabase' })
export const FAKE_SUPABASE_URL = 'https://example.supabase.co'

export const serverEnv = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  SUPABASE_URL: FAKE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_ROLE_KEY,
}
