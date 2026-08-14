# Backend readiness audit

## PASS

- Client and server code are separated; no database connection string is referenced in `src/`.
- SQL defines UUID identifiers, relationships, status references, constraints, checks, timestamps, and relevant catalogue/order indexes.
- Public catalogue queries filter to published records; database calls use the current Neon serverless driver's `sql.query()` API.
- Customer order and quote access is constrained by the authenticated profile; admin authorization is server-side.
- Product-price and order/quote quantity validators reject negative or invalid input.
- The file boundary rejects path-like filenames, unsupported types, and files above 25 MB.

## FIXED

- Added missing first-login profile creation, always assigning `customer` role server-side.
- Removed an invalid profile-column selection in the JWT/profile lookup.
- Added a SPA rewrite for Render and ignored all local `.env` files except the safe example.
- Made production API configuration explicit rather than routing API traffic through Render's static SPA fallback.
- Added atomic status/history updates, strict numeric pagination, missing profile/project routes, and the remaining planned admin management route foundations.
- Gave the rate limiter a real per-client identity (`API_TRUSTED_CLIENT_HEADER`, else a per-session fingerprint) instead of pooling every visitor into one shared bucket, which would have limited the whole site as a single client. The server now refuses to start in production without that header configured.
- Made admin `PATCH` genuinely partial. The shared schemas carried `.default()` values that survived `.partial()`, so any partial update silently reset `status` and `is_configurable`; defaults now belong to the create schemas only, and an empty patch returns `422` rather than writing.
- Restricted `product_image`, `project_image`, and `website_asset` upload intents to administrators. Any signed-in customer could previously mint public-visibility objects; customers retain their own private artwork and proof uploads.
- Scoped `PATCH /api/admin/content/:section` to a single `entry_key`, which previously overwrote every entry in the section with one value.

## REMAINING

- Provision Neon Auth, configure its issuer/JWKS values, and deploy the secure `server/index.js` handler.
- Add the official `@neondatabase/auth` React client and its session/token bridge once the package registry is reachable, then replace the intentionally anonymous placeholder in `src/auth/AuthProvider.jsx`. This must be verified against a provisioned Neon Auth project; it cannot be tested with dummy credentials.
- Apply migrations to a Neon development branch, then test with real Neon Auth tokens.
- Implement the approved object-storage provider in `server/storage.js`; Neon documentation currently describes storage integrations rather than a customer-facing Neon Object Storage service.
- Deploy the secure API handler to the approved server runtime and configure its real absolute API URL in Render. A Render Static Site cannot host it.
- Replace the bounded in-memory rate-limit fallback with a durable distributed limiter at the API runtime before high-volume production traffic.
- Build remaining admin CRUD endpoints and payment provider integration when those workflows are approved.

## BLOCKERS

- No Neon project/auth credentials, API runtime URL, or approved object-storage provider are available in this workspace, so live database, authentication, upload, and integration tests cannot be run safely.
