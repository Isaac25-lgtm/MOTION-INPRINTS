# Production readiness audit

Assessed on the `feat/supabase-migration` branch. Live Render still runs the **Neon** stack until a deliberate cutover.

**Recommendation: do not cut production over to Supabase until a real browser sign-in and an authenticated API request have succeeded against this project.** The application code is wired for Supabase. That is not the same as live verification.

---

## READY (code)

Verified by the current automated suite (see the latest `npm test` / `npm run build` on this branch).

**Commercial correctness.** The server prices everything; no request body carries money. Quote-only configurations cannot be bought. Money is integer shillings; VAT uses basis points.

**Data integrity, enforced in the database:**

| Guarantee | Mechanism |
| --- | --- |
| Accepted quote is immutable | Trigger over header columns + line items |
| One live quote per request | Partial unique index |
| One order per accepted quote | `orders.quote_id UNIQUE` |
| No production without an approved proof | Trigger `guard_production_entry` |
| One proof awaiting response per order | Partial unique index |
| An answered proof cannot be rewritten | Trigger `freeze_answered_proof` |
| Delivery orders carry an address | CHECK constraint |
| Guest tokens stored hashed | CHECK constraint `^[0-9a-f]{64}$` |
| Webhook replays are inert | `UNIQUE(provider, event_id)` |

**Authorization.** Admin routes reject authenticated customers with 403 and anonymous callers with 401. Roles come from `user_profiles`, never from the JWT. Owner access is `OWNER_ALLOWED_EMAILS` (exactly two distinct confirmed addresses on the API) plus `POST /api/staff/bootstrap`. Google sign-in does not grant staff. Guest tracking requires a 256-bit token.

**Workflow.** Status transitions are validated server-side. The customer timeline shows only stages that actually happened.

**Honesty.** No fabricated statistics, testimonials, awards, client counts or company history. No seeded revenue. No fake products or portfolio entries.

**Identity.** The browser uses `@supabase/supabase-js`. The API verifies access tokens with `supabase.auth.getUser` and then loads `user_profiles`. Sign-in is implemented in code; it is not a stub session. Guest browse / quote / cart / checkout / track still work with no session.

## Schema on the rehearsal project

Migrations **0001–0014** were applied through the Supabase SQL Editor (not `db/migrate.js` from this Windows IPv4-only PC). Confirm with `SELECT filename FROM public.schema_migrations ORDER BY filename;` — expect those 14 rows. **Do not re-run the bootstrap SQL.** There is no customer/catalogue data to preserve, but a second apply will fail on existing objects.

## BLOCKERS (operator / live)

None of these are “AuthProvider is disconnected.” They are cutover and content:

1. **Live browser sign-in against this Supabase project has not been verified from this audit.** Email confirmation, Google (Testing audience), and `/manager` bootstrap must be exercised before calling auth live.
2. **Render still points at Neon.** Swap API and frontend variables only after (1), in a deliberate cutover. See `SUPABASE.md` and `DEPLOYMENT.md`.
3. **Object storage.** Signed upload/download against `motion-private` / `motion-public` has not been proven in a browser on this project.
4. **No payment provider.** The abstraction fails loudly rather than pretending.
5. **No real catalogue/content.** Placeholders remain; do not invent products, projects, or testimonials.

Also before public launch: rotate the database password and Google OAuth client secret (they appeared in earlier chat). Keep the Google OAuth app in **Testing** until branding, privacy policy, terms, and domain verification are ready. Add Google test users as **separate** emails, not one comma-separated field.

Two business decisions remain: **VAT registration** (tax is absent until confirmed) and **delivery pricing** (checkout says the cost is confirmed separately).

## OPTIONAL AFTER LAUNCH

- Self-hosted fonts in place of the Google Fonts CDN
- Knockout logo for dark backgrounds
- CSV export from reports
- Media library UI at `/admin/files`
- Admin CMS editing screen (the API and audit trail exist; the form does not)
- Physical-device testing across the stated breakpoints

## Version note

The rehearsal database is Supabase Postgres **17**. Local machines may differ. Applied migrations are the source of truth in `public.schema_migrations`, not a second copy of the SQL.

---

**Do not go live on Supabase** until guest checkout, email/password (including confirm email), Google, a normal customer account, and `/manager` for the two allowlisted owners have been checked against this project with Render pointing at it. Ordinary Google users must remain customers.
