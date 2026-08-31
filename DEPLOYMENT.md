# Deployment

## Render Static Site

Connect the GitHub repository to a Render Static Site and use the production branch (recommendation: `main`).

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- SPA rewrite/fallback: rewrite `/*` to `/index.html`

`render.yaml` records the same configuration. The rewrite is required so direct visits to `/shop`, `/product/example`, and `/manager` load React Router rather than a static-host 404.

Configure only browser-safe `VITE_*` variables in the static site: `VITE_APP_NAME`, `VITE_APP_URL`, and `VITE_API_BASE_URL`. `VITE_API_BASE_URL` is mandatory in production and must be the absolute HTTPS URL of the secure API; it must not be `/api`. Variables are embedded at build time, so rebuild after changing them. Assets emitted by Vite are fingerprinted and cache-friendly. Production source maps are disabled to avoid publishing readable source maps.

### Variables Render prompts for

`render.yaml` declares API secrets with `sync: false`, so **Render asks for each value during the first Blueprint import** rather than deploying without them. No value is committed.

The frontend service does not prompt for secrets. `VITE_API_BASE_URL` and `VITE_APP_URL` are resolved from Render service URLs.

**Changing any `VITE_*` variable needs a new deployment.** Vite embeds these at build time, so editing one in the Render dashboard changes nothing until the site is rebuilt.

**Do not deploy with a fake or `localhost` API URL.** The build will succeed and the deploy will go green, but `assertRuntimeConfig()` throws before React renders and the site is a blank page — which reads as a build problem when it is a configuration one. `VITE_API_BASE_URL` must point at a real, reachable HTTPS API before the first useful deployment.

Never place `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `ADMIN_USERS_JSON`, passwords, hashes, storage keys or payment credentials in the static site's environment. Those belong to the API runtime or a controlled operator machine; anything given a `VITE_` name ships to every visitor in the bundle.

This change must not be deployed to live Render until another engineer has audited the local diff.

## Secure API

`render.yaml` deploys the API as a **Node Web Service** (`motion-api`) alongside the static site. `server/render.js` is a thin bridge — it converts Node requests into Fetch `Request` objects, hands them to the existing handler in `server/index.js`, and writes the `Response` back. No framework, no routing, no new dependency. Every rule about origins, rate limiting, authentication and errors stays in the handler, where it is tested.

`server/dev.js` remains the local entry point.

`npm run start:api` is the start command. `/healthz` answers `200 {"status":"ok"}` without a database, a credential or a configured origin, so a database hiccup cannot look like a dead process and trigger a restart loop.

Supply all server-only variables to `motion-api`, never to the static site. Do not add a Render rewrite for `/api`; the frontend sends API traffic directly to the API origin.

### The two URLs wire themselves

Render assigns both public URLs at Blueprint creation and connects them with `fromService` + `envVarKey: RENDER_EXTERNAL_URL`. Neither `*.onrender.com` hostname is written down, and there is no first-deploy chicken-and-egg.

`property: host` is deliberately **not** used — it returns a *private-network* address, which a browser cannot reach and which is useless as a CORS origin.

`RENDER_EXTERNAL_URL` arrives as an origin with no path, and `render.yaml` cannot concatenate strings, so `src/config/env.js` appends the `/api` prefix when the value carries no path of its own. A value that already has one, such as `http://localhost:8787/api`, is left exactly as given.

### What Render prompts for on the API

| Prompt | Value |
| --- | --- |
| `DATABASE_URL` | **SECRET.** Neon **pooled** `motion_app` runtime URI, `sslmode=require` |
| `ADMIN_USERS_JSON` | **SECRET.** JSON array of administrators with scrypt `passwordHash` values |

`ADMIN_SESSION_HOURS` defaults to `8` in the Blueprint. `API_ALLOWED_ORIGINS` and `VITE_API_BASE_URL` are **not** prompted — Render resolves both. `API_TRUSTED_CLIENT_HEADER` is set to `none` in the Blueprint.

Do **not** put `MIGRATION_DATABASE_URL` on either Render service. Migrations are applied from a controlled machine, never on deploy.

**The database password and administrator hashes must never be pasted into chat, a commit, the static site, or any `VITE_*` variable.** Everything with a `VITE_` name is compiled into the bundle and served to every visitor.

### Rate-limit identity on Render — the trade-off

`API_TRUSTED_CLIENT_HEADER` is set to the literal **`none`**, which is a decision on the record rather than an omission.

**Render appends to `X-Forwarded-For` rather than replacing it**, so its first value is supplied by the caller. Naming it would be *worse than naming nothing*: every anonymous caller could choose their own bucket while the configuration read as though limiting were enforced. Cloudflare's `CF-Connecting-IP` is overwritten at Cloudflare's edge, but Render does not document it and the application cannot verify from inside that a request actually arrived through that edge.

What this means in practice:

- **Callers with a trusted client header are limited per client.** Bearer tokens are never used as a bucket key because public endpoints do not verify them.
- **Anonymous mutations are bounded per endpoint** by `API_ANONYMOUS_MUTATION_MAX` (20 per minute in Render). This limits cost but is deliberately not a replacement for an edge WAF with a verified client address.
- Render's platform DDoS protection sits in front regardless.

If Render later documents a header it overwrites, set `API_TRUSTED_CLIENT_HEADER` to that header's name and anonymous limiting begins working with no code change.

### Before real API calls work

1. **Create the Neon `motion_app` role** in the Neon Console with login enabled and a strong password. Do this before migration `0016`; no role password belongs in Git or migration SQL.
2. **Apply the migrations to Neon** from a controlled machine using the database-owner `MIGRATION_DATABASE_URL` (direct, unpooled). They are never run on deploy. Pooled URLs are rejected because the runner uses a session advisory lock. See `ENVIRONMENT.md`.
3. **Set `ADMIN_USERS_JSON`** with distinct administrator hashes from `scripts/hash-admin-password.js`. Production refuses to start without a valid list.
4. **Configure Render `DATABASE_URL`** with the pooled URI for `motion_app`, not the database owner. Keep the database-owner direct URI only for controlled migrations.
5. **Do not change live Render variables or deploy as part of this local implementation.** Another engineer audits the diff first.

### Free plan

Free web services sleep when idle and cold-start on the next request, which can take tens of seconds. That is fine for first testing, but **not appropriate for a live checkout or payment flow** — a customer will not wait, and a payment webhook arriving at a sleeping instance is a problem you do not want to debug. Move `motion-api` to a paid instance before taking real orders.

The handler uses a server-side Postgres pool (`pg`) against Neon and verifies administrator sessions from hashed rows in PostgreSQL. The browser never receives `DATABASE_URL` or `ADMIN_USERS_JSON`.

### Rate-limit identity

Set `API_TRUSTED_CLIENT_HEADER` to the header your API runtime **overwrites** with the real client address (for example `x-real-ip`, or the platform's own forwarding header). Raw `X-Forwarded-For` is client-supplied and must not be named unless the runtime is known to replace it — otherwise a caller rotates the header and bypasses the limiter entirely.

The server refuses to start when `NODE_ENV=production` and this variable is unset. When no trusted header is available, the server still applies the bounded shared mutation limit, but read traffic cannot be identified reliably inside the application.

The in-memory limiter is per instance. A runtime that scales to several instances needs a shared store before it provides a real guarantee.

## Database migrations

Apply `db/migrations` in filename order to the intended Neon database using a controlled migration process, then promote tested changes. Do not edit an applied migration; create a new numbered migration. Migrations 0001–0014 are immutable. The runner uses one `pg.Client` and an advisory lock on `MIGRATION_DATABASE_URL` (direct). A pooled `DATABASE_URL` is not accepted for migrations. Local development may fall back to a direct localhost `DATABASE_URL`.
