# Backend readiness

Current target: **Neon PostgreSQL** (via `pg` on the Render API) and **server-owned administrator sessions**. Customers never create accounts. The browser talks only to the Motion API. Object storage is unconfigured in this phase and returns `storage_not_configured`.

## PASS

- Client and server code are separated; no database connection string, administrator hash, or migration URI is referenced in `src/`.
- SQL defines UUID identifiers, relationships, status references, constraints, checks, timestamps, and relevant catalogue/order indexes. Migrations 0001–0014 are unchanged; 0015 adds guest contacts, administrator sessions, and disables the previous Data API RLS configuration.
- Public catalogue queries filter to published records; the API uses parameterized `pg` queries and SERIALIZABLE transactions.
- Guest order and quote access is constrained by tracking or quote access tokens; owner authorization is a hashed administrator session. Every `/api/admin/*` endpoint except login independently requires that session.
- Product-price and order/quote quantity validators reject negative or invalid input. The browser never sends a price.
- The file boundary rejects path-like filenames, unsupported types, and files above 25 MB. Until a provider is connected, upload intents return `501 storage_not_configured`.
- Guests can browse, configure, request quotes, check out, and track orders without a session.

## FIXED (retained from earlier backend work)

- Made production API configuration explicit rather than routing API traffic through Render's static SPA fallback.
- Added atomic status/history updates, strict numeric pagination, and the remaining planned admin management route foundations.
- Gave the rate limiter a real per-client identity (`API_TRUSTED_CLIENT_HEADER`, else a per-session fingerprint) instead of pooling every visitor into one shared bucket. The server refuses to start in production without that header configured (`none` is the Render decision).
- Made admin `PATCH` genuinely partial. Empty patches return `422` rather than writing.
- Restricted uploads to administrators once a storage adapter is configured. Guests cannot upload.
- Scoped `PATCH /api/admin/content/:section` to a single `entry_key`.

## REMAINING (operator — not code)

These are operator steps. Do not treat them as missing application features.

- Apply migration **0015** to Neon from a controlled machine using `MIGRATION_DATABASE_URL`. Do not run migrations on Render deploy. Do not apply against the local `motion_dev` database from this change.
- Set `ADMIN_USERS_JSON` on `motion-api` with distinct scrypt hashes. Production refuses to start without a valid list.
- Replace the bounded in-memory rate-limit fallback with a durable distributed limiter before high-volume production traffic.
- Build remaining admin CRUD polish and a payment provider when those workflows are approved.
- Connect an S3-compatible object-storage provider later. Do not pretend uploads succeed until then.

## BLOCKERS

- This local implementation has not been deployed. Live Render must not be changed until the diff is audited.
- Payment provider and a proven signed upload/download remain outstanding.
