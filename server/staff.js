import { ApiError } from './http.js'
import { requireAuth, resolveVerifiedIdentity, isApprovedOwnerEmail } from './auth.js'

/* Staff bootstrap: turns a verified Supabase Auth session into an owner profile.
 *
 * The problem it solves: Supabase Auth and Motion keep separate records. Signing
 * in with Google creates a Supabase identity but no `user_profiles` row, and the
 * ordinary onboarding form only ever writes `customer`. So an approved owner
 * could authenticate perfectly and still be unable to reach the dashboard, with
 * no path that would ever grant it.
 *
 * The rules this enforces, in order:
 *
 *   1. A cryptographically verified session, or nothing happens.
 *   2. The email is resolved SERVER-SIDE from Supabase Auth's `getUser` result
 *      — never taken from the request body, never from a token claim parsed
 *      here.
 *   3. The address must be confirmed AND on the server-only allowlist.
 *   4. Only then is a profile created or upgraded to `owner`.
 *
 * A caller who is not approved gets a neutral refusal. It does not say whether
 * the address is unknown, unverified, or simply not an owner: all three would
 * tell an attacker something about an account they do not control.
 *
 * Idempotent by construction. Signing in ten times produces one profile, because
 * `auth_user_id` is UNIQUE and the write is an upsert rather than an insert.
 */

/** Records the grant so an elevation is never invisible after the fact. */
async function recordAudit(db, { authUserId, profileId, action, summary }) {
  try {
    await db.query(
      `INSERT INTO public.admin_audit_log(actor_auth_user_id, action, entity_type, entity_id, summary, detail)
       VALUES ($1,$2,'user_profile',$3,$4,$5::jsonb)`,
      [authUserId, action, profileId, summary, JSON.stringify({ source: 'staff_bootstrap' })],
    )
  } catch {
    /* Auditing must never be able to fail a legitimate sign-in. The grant is
       already durable in user_profiles; a lost audit row is worth less than a
       locked-out owner. */
  }
}

/**
 * POST /api/staff/bootstrap
 *
 * Returns `{ data: { owner: true, profile } }` for an approved identity, or a
 * 403 with a neutral message for anyone else.
 */
export async function staffBootstrap(request, db, authenticate, options = {}) {
  const { ownerAllowedEmails = [], ownersConfigured = ownerAllowedEmails.length > 0 } = options
  const actor = await requireAuth(request, authenticate)

  /* Distinct from a refusal, because the causes are different and so are the
     fixes: this one is the operator's to solve, not the caller's. It still says
     nothing about who is approved, and it is reported ONLY here — the public API
     keeps serving customers regardless of staff configuration. */
  if (!ownersConfigured) {
    throw new ApiError(503, 'staff_configuration_unavailable', 'Staff access is not available on this installation.')
  }

  const identity = resolveVerifiedIdentity(actor)
  const approved = identity && isApprovedOwnerEmail(identity.email, ownerAllowedEmails)

  if (!approved) {
    /* Deliberately identical for an unknown address, an unverified one, and a
       genuine customer. No profile is created and no existing role is touched. */
    throw new ApiError(403, 'not_authorised_for_staff', 'This account is not authorised for Motion staff access.')
  }

  /* Upsert on auth_user_id. Creates the profile for a first staff sign-in, and
     upgrades an existing customer profile in place rather than creating a second
     one — the person is the same person, and two rows would split their order
     history from their access.

     `full_name` uses COALESCE so an existing name is never overwritten by the
     identity's, while a brand-new row still gets something sensible. */
  const rows = await db.query(
    `INSERT INTO public.user_profiles(auth_user_id, role, full_name)
     VALUES ($1, 'owner', $2)
     ON CONFLICT (auth_user_id) DO UPDATE
       SET role = 'owner',
           full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
           updated_at = now()
     RETURNING id, auth_user_id, role, full_name, phone, company_name`,
    [actor.authUserId, identity.email],
  )

  const profile = rows[0]
  const upgraded = Boolean(actor.profile) && actor.profile.role !== 'owner'
  await recordAudit(db, {
    authUserId: actor.authUserId,
    profileId: profile.id,
    action: upgraded ? 'staff.role_upgraded' : 'staff.owner_provisioned',
    summary: upgraded ? 'Existing profile upgraded to owner' : 'Owner profile provisioned',
  })

  return { data: { owner: true, profile } }
}
