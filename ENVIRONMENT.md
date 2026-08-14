# Environment configuration

Copy `.env.example` to `.env` for local development. `.env` is ignored by Git. Vite can only expose variables beginning with `VITE_`; do not add secret values with that prefix.

| Variable | Purpose | Exposure | Local configuration | Production configuration |
| --- | --- | --- | --- | --- |
| `VITE_APP_NAME` | Browser display name | Browser-safe | `.env` | Render Static Site environment group/service |
| `VITE_APP_URL` | Public frontend URL | Browser-safe | `.env` | Render Static Site |
| `VITE_API_BASE_URL` | Base URL of the secure API | Browser-safe | `.env` | Render Static Site |
| `VITE_NEON_AUTH_URL` | Neon Auth client endpoint | Browser-safe | `.env` | Render Static Site / Neon branch config |
| `DATABASE_URL` | Neon Postgres connection string | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `NEON_AUTH_JWKS_URL` | JWT verification keys endpoint | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `NEON_AUTH_ISSUER` | Expected Neon Auth token issuer | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `API_ALLOWED_ORIGINS` | Comma-separated permitted frontend origins | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `API_TRUSTED_CLIENT_HEADER` | Header the API runtime overwrites with the real client address, used as the rate-limit identity. **Required in production** — the server refuses to start without it when `NODE_ENV=production`. Never name a header a client can forge. | Server-only | API runtime `.env` (may be blank) | secure API/Neon runtime only |
| `API_REQUEST_TIMEOUT_MS` | Upstream request timeout | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX_REQUESTS` | Rate-limit policy settings | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `API_RATE_LIMIT_MAX_KEYS` | Maximum in-memory fallback rate-limit buckets | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `OBJECT_STORAGE_*` | Storage endpoint, bucket, credentials and signing | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_API_KEY` | Future payment verification/provider access | Server-only | API runtime `.env` | secure API/Neon runtime only |

`DATABASE_URL`, storage keys, signing keys, payment secrets, and any service credential must never be placed in the React application, Git, documentation examples, or Render's static build environment.

For production, `VITE_API_BASE_URL` must be an absolute HTTPS API URL; `/api` is only valid when a local development proxy exists. A Render Static Site cannot execute `server/index.js`.
