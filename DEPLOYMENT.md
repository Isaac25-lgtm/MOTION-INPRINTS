# Deployment

## Render Static Site

Connect the GitHub repository to a Render Static Site and use the production branch (recommendation: `main`).

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- SPA rewrite/fallback: rewrite `/*` to `/index.html`

`render.yaml` records the same configuration. The rewrite is required so direct visits to `/shop`, `/product/example`, and `/admin` load React Router rather than a static-host 404.

Configure only browser-safe `VITE_*` variables in the static site. `VITE_API_BASE_URL` is mandatory in production and must be the absolute HTTPS URL of the secure API; it must not be `/api`. Variables are embedded at build time, so rebuild after changing them. Assets emitted by Vite are fingerprinted and cache-friendly. Production source maps are disabled to avoid publishing readable source maps.

### Variables Render prompts for

`render.yaml` declares three variables with `sync: false`, so **Render asks for each value during the first Blueprint import** rather than deploying without them. No value is committed — a URL in the repository would be wrong for any other deployment, and is how a secret eventually ends up there.

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | The **final public HTTPS URL of the secure API**. Not `/api`, not a placeholder, and never `localhost` |
| `VITE_NEON_AUTH_URL` | The public Neon Auth URL, including the `/neondb/auth` path |
| `VITE_NEON_AUTH_GOOGLE` | `true` to show the optional Google button |

Three things worth knowing:

- **Email and password is always available.** `VITE_NEON_AUTH_GOOGLE` only controls whether the Google button is *also* offered; it never disables the email flow.
- **It defaults to shown.** Only the exact string `false` hides the button — leaving the prompt blank still shows it. If Google is not working on your Neon project, set `false` explicitly rather than leaving it empty.
- **Changing any `VITE_*` variable needs a new deployment.** Vite embeds these at build time, so editing one in the Render dashboard changes nothing until the site is rebuilt.

**Do not deploy with a fake or `localhost` API URL.** The build will succeed and the deploy will go green, but `assertRuntimeConfig()` throws before React renders and the site is a blank page — which reads as a build problem when it is a configuration one. `VITE_API_BASE_URL` must point at a real, reachable HTTPS API before the first useful deployment.

Never place `DATABASE_URL`, Neon secrets, passwords, storage keys or payment credentials in the static site's environment. Those belong to the API runtime; anything given a `VITE_` name ships to every visitor in the bundle.

## Secure API

`render.yaml` deploys the API as a **Node Web Service** (`motion-api`) alongside the static site. `server/render.js` is a thin bridge — it converts Node requests into Fetch `Request` objects, hands them to the existing handler in `server/index.js`, and writes the `Response` back. No framework, no routing, no new dependency. Every rule about origins, rate limiting, authentication and errors stays in the handler, where it is tested.

`server/dev.js` is unchanged and remains the local entry point against a local PostgreSQL.

`npm run start:api` is the start command. `/healthz` answers `200 {"status":"ok"}` without a database, a credential or a configured origin, so a database hiccup cannot look like a dead process and trigger a restart loop.

Supply all server-only variables to `motion-api`, never to the static site. Do not add a Render rewrite for `/api`; the frontend sends API traffic directly to the API origin.

### The two URLs wire themselves

Render assigns both public URLs at Blueprint creation and connects them with `fromService` + `envVarKey: RENDER_EXTERNAL_URL`. Neither `*.onrender.com` hostname is written down, and there is no first-deploy chicken-and-egg.

`property: host` is deliberately **not** used — it returns a *private-network* address, which a browser cannot reach and which is useless as a CORS origin.

`RENDER_EXTERNAL_URL` arrives as an origin with no path, and `render.yaml` cannot concatenate strings, so `src/config/env.js` appends the `/api` prefix when the value carries no path of its own. A value that already has one, such as `http://localhost:8787/api`, is left exactly as given.

### What Render prompts for

| Prompt | Value |
| --- | --- |
| `DATABASE_URL` (API) | **SECRET.** Paste privately from Neon's newly rotated connection string |
| `NEON_AUTH_JWKS_URL` (API) | The full Neon Auth JWKS URL, ending `/.well-known/jwks.json` |
| `NEON_AUTH_ISSUER` (API) | The Neon Auth **origin only** — no `/neondb/auth` path |
| `VITE_NEON_AUTH_URL` (frontend) | The **full** Neon Auth URL, including `/neondb/auth` |
| `VITE_NEON_AUTH_GOOGLE` (frontend) | `true` |

`VITE_API_BASE_URL` and `API_ALLOWED_ORIGINS` are **not** prompted — Render resolves both.

**The database password must never be pasted into chat, a commit, the static site, or any `VITE_*` variable.** Everything with a `VITE_` name is compiled into the bundle and served to every visitor.

### Rate-limit identity on Render — the trade-off

`API_TRUSTED_CLIENT_HEADER` is set to the literal **`none`**, which is a decision on the record rather than an omission.

**Render appends to `X-Forwarded-For` rather than replacing it**, so its first value is supplied by the caller. Naming it would be *worse than naming nothing*: every anonymous caller could choose their own bucket while the configuration read as though limiting were enforced. Cloudflare's `CF-Connecting-IP` is overwritten at Cloudflare's edge, but Render does not document it and the application cannot verify from inside that a request actually arrived through that edge.

What this means in practice:

- **Authenticated callers are limited per session.** The session is checked *before* any client-supplied header, so spoofing a header cannot widen or escape a session's bucket.
- **Anonymous callers are not rate limited by this service.** Pooling them into one bucket would throttle the entire site as a single visitor, which is worse.
- Render's platform DDoS protection sits in front regardless.

If Render later documents a header it overwrites, set `API_TRUSTED_CLIENT_HEADER` to that header's name and anonymous limiting begins working with no code change.

### Before real API calls work

1. **Apply the migrations to the new Neon project.** They are never run on deploy — a deploy that silently alters a schema is how a production database gets changed by accident. Run `node db/migrate.js --dry-run`, then `node db/migrate.js`, with `DATABASE_URL` pointed at Neon.
2. **Add the frontend's Render URL to Neon Auth trusted domains** once Render has created it. Sign-in fails with `INVALID_ORIGIN` until you do.

### Free plan

Free web services sleep when idle and cold-start on the next request, which can take tens of seconds. That is fine for first testing, but **not appropriate for a live checkout or payment flow** — a customer will not wait, and a payment webhook arriving at a sleeping instance is a problem you do not want to debug. Move `motion-api` to a paid instance before taking real orders.

The handler uses a server-side Neon connection and verifies Neon Auth JWTs against its JWKS endpoint. The browser never receives `DATABASE_URL`.

### Rate-limit identity

Set `API_TRUSTED_CLIENT_HEADER` to the header your API runtime **overwrites** with the real client address (for example `x-real-ip`, or the platform's own forwarding header). Raw `X-Forwarded-For` is client-supplied and must not be named unless the runtime is known to replace it — otherwise a caller rotates the header and bypasses the limiter entirely.

The server refuses to start when `NODE_ENV=production` and this variable is unset. When it is unset outside production, authenticated callers are still bucketed per session, while anonymous callers are not limited: they cannot be distinguished, and pooling them into one bucket would rate-limit the whole site as if it were a single visitor.

The in-memory limiter is per instance. A runtime that scales to several instances needs a shared store before it provides a real guarantee.

## Database migrations

Apply `db/migrations` in filename order to the intended Neon branch using a controlled migration process (CI or Neon SQL editor), then promote tested branch changes to production. Do not edit an applied migration; create a new numbered migration.
