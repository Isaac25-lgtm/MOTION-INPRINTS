# Production readiness audit

Assessed after replacing customer identity and Supabase dependencies with Neon PostgreSQL and server-owned administrator sessions. **Do not deploy this change to live Render until the local diff has been audited.**

**Recommendation: keep live Render unchanged.** Apply 0015 and swap environment variables only after that audit, from a controlled machine, using a direct Neon connection for migrations.

---

## READY (code)

Verified by the current automated suite (see the latest `npm test` / `npm run build` on this working tree).

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

**Authorization.** Customers never authenticate. Admin routes reject anonymous callers with 401 and non-owner actors with 403. Owner access is a hashed opaque session issued from `ADMIN_USERS_JSON`. Guest tracking and quote access require a 256-bit token; a reference or quote id alone is never enough.

**Workflow.** Status transitions are validated server-side. The customer timeline shows only stages that actually happened.

**Honesty.** No fabricated statistics, testimonials, awards, client counts or company history. No seeded revenue. No fake products or portfolio entries. Uploads return `storage_not_configured` until a provider is connected.

**Identity.** Administrators sign in with username and password. The raw token lives in browser `sessionStorage`. Only the SHA-256 hash is stored. Guest browse / quote / cart / checkout / track work with no session.

## Schema

Migrations **0001–0014 are immutable**. **0015** adds `customer_contacts`, `admin_sessions`, `admin_login_attempts`, nullable `contact_id` foreign keys, a snapshot backfill, and disables the previous Data API RLS configuration. `user_profiles` and `customer_id` remain for rollback and must not be used by application code.

## BLOCKERS (operator / live)

1. **This change is not deployed.** Do not update live Render services or the production database from this work.
2. **Object storage.** No signed upload/download provider is connected.
3. **No payment provider.** The abstraction fails loudly rather than pretending.
4. **No real catalogue/content.** Placeholders remain; do not invent products, projects, or testimonials.

Two business decisions remain: **VAT registration** (tax is absent until confirmed) and **delivery pricing** (checkout says the cost is confirmed separately).

## OPTIONAL AFTER LAUNCH

- Self-hosted fonts in place of the Google Fonts CDN
- Knockout logo for dark backgrounds
- CSV export from reports
- Media library UI at `/admin/files` once storage exists
- Admin CMS editing screen (the API and audit trail exist; the form does not)
- Physical-device testing across the stated breakpoints

## Version note

Applied migrations are the source of truth in `public.schema_migrations`, not a second copy of the SQL.

---

**Do not go live on this branch** until guest checkout, inquiry submission, quote response by token, order tracking, and `/manager` username/password sign-in have been checked against a Neon database that is not the live Render database.
