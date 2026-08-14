# Deployment

## Render Static Site

Connect the GitHub repository to a Render Static Site and use the production branch (recommendation: `main`).

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- SPA rewrite/fallback: rewrite `/*` to `/index.html`

`render.yaml` records the same configuration. The rewrite is required so direct visits to `/shop`, `/product/example`, and `/admin` load React Router rather than a static-host 404.

Configure only browser-safe `VITE_*` variables in the static site. `VITE_API_BASE_URL` is mandatory in production and must be the absolute HTTPS URL of the secure API; it must not be `/api`. Variables are embedded at build time, so rebuild after changing them. Assets emitted by Vite are fingerprinted and cache-friendly. Production source maps are disabled to avoid publishing readable source maps.

## Secure API

Render Static Sites do not execute server functions. Deploy the web-standard handler in `server/index.js` to the approved secure API runtime and point `VITE_API_BASE_URL` at it. Supply all server-only variables there, not in Render's static site. Do not add a Render rewrite for `/api`; the frontend sends API traffic directly to the configured HTTPS API origin.

The handler uses a server-side Neon connection and verifies Neon Auth JWTs against its JWKS endpoint. The browser never receives `DATABASE_URL`.

### Rate-limit identity

Set `API_TRUSTED_CLIENT_HEADER` to the header your API runtime **overwrites** with the real client address (for example `x-real-ip`, or the platform's own forwarding header). Raw `X-Forwarded-For` is client-supplied and must not be named unless the runtime is known to replace it — otherwise a caller rotates the header and bypasses the limiter entirely.

The server refuses to start when `NODE_ENV=production` and this variable is unset. When it is unset outside production, authenticated callers are still bucketed per session, while anonymous callers are not limited: they cannot be distinguished, and pooling them into one bucket would rate-limit the whole site as if it were a single visitor.

The in-memory limiter is per instance. A runtime that scales to several instances needs a shared store before it provides a real guarantee.

## Database migrations

Apply `db/migrations` in filename order to the intended Neon branch using a controlled migration process (CI or Neon SQL editor), then promote tested branch changes to production. Do not edit an applied migration; create a new numbered migration.
