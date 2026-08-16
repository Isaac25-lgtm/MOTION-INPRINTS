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

Render Static Sites do not execute server functions. Deploy the web-standard handler in `server/index.js` to the approved secure API runtime and point `VITE_API_BASE_URL` at it. Supply all server-only variables there, not in Render's static site. Do not add a Render rewrite for `/api`; the frontend sends API traffic directly to the configured HTTPS API origin.

The handler uses a server-side Neon connection and verifies Neon Auth JWTs against its JWKS endpoint. The browser never receives `DATABASE_URL`.

### Rate-limit identity

Set `API_TRUSTED_CLIENT_HEADER` to the header your API runtime **overwrites** with the real client address (for example `x-real-ip`, or the platform's own forwarding header). Raw `X-Forwarded-For` is client-supplied and must not be named unless the runtime is known to replace it — otherwise a caller rotates the header and bypasses the limiter entirely.

The server refuses to start when `NODE_ENV=production` and this variable is unset. When it is unset outside production, authenticated callers are still bucketed per session, while anonymous callers are not limited: they cannot be distinguished, and pooling them into one bucket would rate-limit the whole site as if it were a single visitor.

The in-memory limiter is per instance. A runtime that scales to several instances needs a shared store before it provides a real guarantee.

## Database migrations

Apply `db/migrations` in filename order to the intended Neon branch using a controlled migration process (CI or Neon SQL editor), then promote tested branch changes to production. Do not edit an applied migration; create a new numbered migration.
