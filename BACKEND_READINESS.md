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

## REMAINING

- Provision Neon Auth, configure its issuer/JWKS values, and deploy the secure `server/index.js` handler.
- Apply migrations to a Neon development branch, then test with real Neon Auth tokens.
- Implement the approved object-storage provider in `server/storage.js`; Neon documentation currently describes storage integrations rather than a customer-facing Neon Object Storage service.
- Deploy the secure API handler to the approved server runtime and configure its real absolute API URL in Render. A Render Static Site cannot host it.
- Replace the bounded in-memory rate-limit fallback with a durable distributed limiter at the API runtime before high-volume production traffic.
- Build remaining admin CRUD endpoints and payment provider integration when those workflows are approved.

## BLOCKERS

- No Neon project/auth credentials, API runtime URL, or approved object-storage provider are available in this workspace, so live database, authentication, upload, and integration tests cannot be run safely.
