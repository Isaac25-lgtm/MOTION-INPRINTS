# Production readiness audit — Prompt 10.8

Assessed at the completion of Categories 9 and 10.

**Recommendation: `DO NOT GO LIVE`.**

Not because the software is defective. The code is in good shape. The blockers are external dependencies that have not been provisioned, and one of them means no customer can sign in at all.

---

## READY

Verified by 172 automated tests, 26 of which execute against real PostgreSQL, plus a clean production build at 98 modules.

**Commercial correctness.** The server prices everything; no request body carries money. A cart claiming `UGX 1` for a `UGX 100,000` product is charged 100,000. Quote-only configurations cannot be bought. Money is integer shillings throughout, with VAT via basis points so no float error can enter a total.

**Data integrity, enforced in the database rather than by handler discipline:**

| Guarantee | Mechanism |
| --- | --- |
| Accepted quote is immutable | Trigger over 20 header columns + line items |
| One live quote per request | Partial unique index |
| One order per accepted quote | `orders.quote_id UNIQUE` |
| No production without an approved proof | Trigger `guard_production_entry` |
| One proof awaiting response per order | Partial unique index |
| An answered proof cannot be rewritten | Trigger `freeze_answered_proof` |
| Delivery orders carry an address | CHECK constraint |
| Guest tokens stored hashed | CHECK constraint `^[0-9a-f]{64}$` |
| Webhook replays are inert | `UNIQUE(provider, event_id)` |

**Authorization.** Admin routes reject authenticated customers with 403 and anonymous callers with 401. Customer isolation is enforced by ownership checks on the server, tested through the API rather than by hiding links. Guest tracking requires a 256-bit token; an order reference alone returns the same 404 as an unknown reference, so references cannot be enumerated.

**Workflow.** Status transitions are validated server-side — an order cannot jump from `new` to `completed`, reopen once finished, or enter production without approval. The customer timeline shows only stages that actually happened, with real timestamps and no invented dates.

**Honesty.** No fabricated statistics, testimonials, awards, client counts or company history anywhere — enforced by test. No seeded revenue. No fake products or portfolio entries. Where Motion has no data, the interface says so.

## FIXED during this phase

- **Skipped workflow stages were shown as completed with no date.** An order that never awaited payment displayed that stage ticked. Found by test; timeline now shows only stages actually reached.
- Guest tracking previously had no credential at all — an order number would have been sufficient. Now a separate hashed token.
- Order status changes had no transition validation and no audit entry. Both added, with a concurrency guard so a simultaneous change loses rather than overwrites.

## BLOCKERS

Five, none of them code:

1. **Neon Auth is not connected.** `AuthProvider` returns a hardcoded anonymous session, so every `/account/*` and `/admin/*` route redirects away. The entire customer portal and admin dashboard built in Categories 9 and 10 are **correct and unreachable**. This is the largest blocker and gates the other four from being meaningfully tested.
2. **No API runtime.** A Render Static Site cannot execute `server/index.js`. Payment webhooks are inbound HTTP from a third party and are therefore *structurally* unreachable, not merely untested.
3. **No object storage.** Artwork and proof files have validation, ownership rules and lifecycle transitions, but no provider to transfer to. Proof review works; proof *viewing* does not.
4. **No payment provider.** Deliberate, per Prompt 8.5. The abstraction is complete and fails loudly rather than pretending.
5. **No real content.** Zero products, zero projects, empty CMS. The site is image-led by design and currently renders labelled placeholders throughout. Its actual visual quality is unproven.

Two decisions also remain: **VAT registration** (tax is absent until confirmed, never assumed) and **delivery pricing** (checkout says the cost is confirmed separately rather than inventing a figure).

## OPTIONAL AFTER LAUNCH

- Self-hosted fonts in place of the Google Fonts CDN
- Knockout logo for dark backgrounds
- CSV export from reports
- Media library UI at `/admin/files`
- Admin CMS editing screen (the API and audit trail exist; the form does not)
- Physical-device testing across the stated breakpoints

## Version note

Local development runs PostgreSQL 18; Neon runs 16/17. All ten migrations and every trigger behave correctly on 18, but **local green is not proof for Neon**. Apply the migrations to a Neon branch and run the integration suite there before launch.

---

**`DO NOT GO LIVE`** — sign-in does not exist, so no customer can reach an account, no administrator can reach the dashboard, and no payment can be taken or verified. Resolve blockers 1–3, choose a provider for 4, and load real content for 5. The software is ready for those things to be plugged into it.
