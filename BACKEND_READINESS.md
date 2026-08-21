# Backend readiness

Current target: **Supabase Auth**, **Supabase Postgres** (via `pg` on the Render API), and **Supabase Storage**. The browser talks only to the Motion API. See `SUPABASE.md` for rehearsal and cutover. Neon remains running until a deliberate cutover; it is not required by this codebase.

## PASS

- Client and server code are separated; no database connection string or service-role key is referenced in `src/`.
- SQL defines UUID identifiers, relationships, status references, constraints, checks, timestamps, and relevant catalogue/order indexes. Migrations 0001–0013 are unchanged; 0014 adds RLS (not FORCED) and Storage buckets.
- Public catalogue queries filter to published records; the API uses parameterized `pg` queries and SERIALIZABLE transactions.
- Customer order and quote access is constrained by the authenticated profile; owner authorization is server-side (`getUser` + `user_profiles.role` + `OWNER_ALLOWED_EMAILS`).
- Product-price and order/quote quantity validators reject negative or invalid input. The browser never sends a price.
- The file boundary rejects path-like filenames, unsupported types, and files above 25 MB. Private artwork and public catalogue images use separate buckets.
- Guests can browse, configure, request quotes, check out, and track orders without a session.

## FIXED (retained from earlier backend work)

- Added missing first-login profile creation, always assigning `customer` role server-side.
- Made production API configuration explicit rather than routing API traffic through Render's static SPA fallback.
- Added atomic status/history updates, strict numeric pagination, missing profile/project routes, and the remaining planned admin management route foundations.
- Gave the rate limiter a real per-client identity (`API_TRUSTED_CLIENT_HEADER`, else a per-session fingerprint) instead of pooling every visitor into one shared bucket. The server refuses to start in production without that header configured (`none` is the Render decision).
- Made admin `PATCH` genuinely partial. Empty patches return `422` rather than writing.
- Restricted `product_image`, `project_image`, and `website_asset` upload intents to owners. Customers retain their own private artwork and proof uploads.
- Scoped `PATCH /api/admin/content/:section` to a single `entry_key`.

## REMAINING (cutover — not code)

These are operator steps. Do not treat them as missing application features.

- Apply migrations 0001–0014 to the empty Supabase project using its **direct** connection string (`SUPABASE.md`).
- Configure Supabase Auth: email confirmation, Google provider, and redirect URLs (`localhost`, `127.0.0.1`, then the Render frontend). Same-email Google and email/password identities are linked automatically; do not enable a dashboard “automatic linking” setting — that control is for **manual** linking, which this app does not use.
- Add the Supabase variables on Render (`motion-api` and `motion-frontend`). Do not deploy a cutover until guest checkout, customer sign-in, Google, email/password, and `/manager` have been verified against Supabase.
- Replace the bounded in-memory rate-limit fallback with a durable distributed limiter before high-volume production traffic.
- Build remaining admin CRUD polish and a payment provider when those workflows are approved.
- Only then retire the Neon project and Neon-named Render variables.

## BLOCKERS

- Live sign-in against the Supabase project has not yet been verified in a browser.
- Render still points at Neon until the cutover above is done on purpose.
- Payment provider and a proven signed upload/download against the live buckets remain outstanding.
