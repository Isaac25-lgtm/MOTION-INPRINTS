import { createClient } from '@supabase/supabase-js'

/* Server-only Supabase client. Uses the service_role key, which bypasses RLS
 * and must never reach the browser. Created once per process.
 *
 * persistSession is off: this process does not represent a user. Auth calls
 * pass a bearer token explicitly (`auth.getUser(token)`). */

export function createSupabaseAdmin({ supabaseUrl, supabaseServiceRoleKey }) {
  if (!supabaseUrl) throw new Error('SUPABASE_URL is required.')
  if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.')
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
