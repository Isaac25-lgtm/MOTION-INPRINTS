# Environment configuration

Copy `.env.example` to `.env` for local development. The file is ignored by Git. Vite can only expose variables beginning with `VITE_`; do not add secret values with that prefix.

Neon PostgreSQL is the only business database. Customers never create accounts. Administrators sign in with usernames and scrypt password hashes stored in `ADMIN_USERS_JSON`.

| Variable | Purpose | Exposure | Local configuration | Production configuration |
| --- | --- | --- | --- | --- |
| `VITE_APP_NAME` | Browser display name | Browser-safe | `.env` | Render Static Site |
| `VITE_APP_URL` | Public frontend URL | Browser-safe | `.env` | Render Static Site |
| `VITE_API_BASE_URL` | Base URL of the secure API | Browser-safe | `.env` | Render Static Site |
| `VITE_STORAGE_PUBLIC_BASE_URL` | Optional public catalogue-image prefix. Blank while storage is unconfigured. | Public | `.env` (may be blank) | Render Static Site (optional) |
| `DATABASE_URL` | Neon **pooled** runtime connection | **SECRET**, server-only | API runtime `.env` | `motion-api` only |
| `MIGRATION_DATABASE_URL` | Neon **direct, unpooled** connection for migrations and dumps | **SECRET**, operator-only | API runtime `.env` or a controlled machine | Not on Render services. Apply migrations from a controlled machine. |
| `ADMIN_USERS_JSON` | Administrator list: UUID, unique username, scrypt `passwordHash` | **SECRET**, server-only | API runtime `.env` | `motion-api` only |
| `ADMIN_SESSION_HOURS` | Opaque session lifetime (default 8, range 1–168) | Server-only | API runtime `.env` | `motion-api` |
| `API_ALLOWED_ORIGINS` | Comma-separated permitted frontend origins | Server-only | API runtime `.env` | `motion-api` (wired from the frontend URL) |
| `API_TRUSTED_CLIENT_HEADER` | Header the API runtime overwrites with the real client address. **Required in production**. Literal `none` is the Render decision. | Server-only | API runtime `.env` (may be blank) | `motion-api` (`none`) |
| `API_REQUEST_TIMEOUT_MS` | Upstream request timeout | Server-only | API runtime `.env` | `motion-api` |
| `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX_REQUESTS` | Rate-limit policy settings | Server-only | API runtime `.env` | `motion-api` |
| `API_RATE_LIMIT_MAX_KEYS` | Maximum in-memory fallback rate-limit buckets | Server-only | API runtime `.env` | `motion-api` |
| `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_API_KEY` | Future payment verification/provider access | Server-only | API runtime `.env` | `motion-api` |

`DATABASE_URL`, `MIGRATION_DATABASE_URL`, `ADMIN_USERS_JSON`, storage credentials, payment secrets, and any service credential must never be placed in the React application, Git, documentation examples, or Render's static build environment.

For production, `VITE_API_BASE_URL` must be an absolute HTTPS API URL; `/api` is only valid when a local development proxy exists. A Render Static Site cannot execute `server/index.js`.

Obsolete names that must not be set (the process refuses to start if they are present): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_ALLOWED_EMAILS`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_GOOGLE`, `VITE_NEON_AUTH_URL`, `VITE_NEON_AUTH_GOOGLE`, `VITE_NEON_AUTH_VERIFICATION`, `VITE_NEON_AUTH_PROJECT_ID`, `VITE_NEON_AUTH_PUBLISHABLE_KEY`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_ISSUER`.

---

# Neon PostgreSQL

`DATABASE_URL` is the pooled Neon endpoint used by the Node API (`pg.Pool`). `MIGRATION_DATABASE_URL` is the direct, unpooled endpoint. Migrations take a session advisory lock, so pooled URLs (`-pooler` host, `pooler.` host, `pgbouncer=true`, or port `6543`) are rejected.

Local development may omit `MIGRATION_DATABASE_URL` when `DATABASE_URL` itself is a direct localhost connection.

Before applying migration `0016_neon_runtime_role.sql`, create a `motion_app` role with login enabled and a strong password in the Neon Console. The migration refuses to create a passwordless role; it verifies the role and grants only the runtime privileges it needs. After the migration succeeds, configure the pooled production `DATABASE_URL` with username `motion_app`. The migration URI remains the database-owner direct URL and is used only from a controlled machine.

TLS is required for hosted Neon URLs (`sslmode=require`). Channel binding can be requested by adding `channel_binding=require` to the URI when Neon and the driver support it. The application does not rewrite connection strings.

Do not run migrations automatically during Render deploys. Apply `db/migrations` from a controlled machine:

```sh
node --env-file=.env db/migrate.js --dry-run
node --env-file=.env db/migrate.js
```

Never pass a connection string as a command-line argument.

---

# Administrator sessions

Administrators log in at `/manager` with a username and password. Credentials are not stored in the database. They come from server-only `ADMIN_USERS_JSON`:

```json
[{"id":"valid-uuid","username":"unique-name","passwordHash":"scrypt$..."}]
```

Use one row per person. Never share a username. Generate hashes with a hidden prompt — never a command-line argument:

```sh
node scripts/hash-admin-password.js
```

The script prints only the encoded scrypt hash. Paste that hash into `ADMIN_USERS_JSON`, not the password.

Production refuses to start if `ADMIN_USERS_JSON` is missing or malformed. Outside production an empty value means nobody can sign in; the public site still works.

Login:

1. `POST /api/admin/session` with `{ username, password }` returns the administrator and a random opaque token (≥256 bits).
2. The browser stores the raw token in `sessionStorage` (`motion.admin.session`), never `localStorage`.
3. `GET /api/admin/session` restores the session from the bearer token. Only the SHA-256 hash is stored in `admin_sessions`.
4. `DELETE /api/admin/session` revokes the database row and the client clears `sessionStorage`.
5. Default expiry is eight hours (`ADMIN_SESSION_HOURS`). Expired and revoked sessions are rejected.
6. Failed attempts are throttled per hashed normalized username. Known and unknown usernames do the same work and return the same message.

The actor exposed to the API is `{ actorId, username, role: "owner" }`. `actorId` is the stable UUID from `ADMIN_USERS_JSON` and is written into existing `*_auth_user_id` audit columns. Every `/api/admin/*` endpoint except login independently requires a valid session. Frontend route guards only control rendering.

There is no email authentication, email verification, Google OAuth, password-reset email, customer identity provider, or JWT from a third party.

---

# Guest customers

Customers never create accounts or sign in. They browse, configure products, use the cart, submit inquiries, place orders, receive quotes, and track orders as guests.

Checkout and inquiry submission upsert `customer_contacts` by normalized email and write `contact_id` onto the order or quote request. Historical contact snapshots on those rows are not rewritten. Email is operational contact information, never an authentication identifier.

Order tracking, proof response, and reorder require the order reference **and** the tracking token. A reference alone is never enough. Quote response authorises only through the quote access token.

---

# Object storage

Neon does not replace object storage. This phase uses an unconfigured adapter and returns `storage_not_configured` rather than pretending an upload succeeded. Send artwork and reference files directly until an S3-compatible provider is added later.

---

# Real-browser checklist

| # | Check | Pass when |
| --- | --- | --- |
| 1 | **Guest purchase** | Cart, checkout, quote request, custom project and order tracking work with no session |
| 2 | **Tracking token** | The confirmation page shows the one-time tracking code; reference alone does not open the order |
| 3 | **Quote link** | A sent quote opens with its access token and can be accepted, declined, or annotated |
| 4 | **Staff sign-in** | An administrator username/password at `/manager` reaches `/manager/dashboard` |
| 5 | **Staff denial** | A wrong password and an unknown username show the same message; `GET /api/admin/products` is 401 without a session |
| 6 | **No customer accounts** | `/sign-in`, `/sign-up`, `/account` are not routes |

Do not paste real passwords, hashes, or connection strings into chat, commits, or documentation.
