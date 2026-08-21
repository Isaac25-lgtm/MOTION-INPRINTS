# Supabase migration and rehearsal

Motion is moving identity, Postgres and object storage from Neon to Supabase. The existing Neon project is **not** deleted, disabled or migrated by this work. Live Render environment variables are **not** changed here. This document is the rehearsal path against an empty Supabase project.

Current project origin (public): `https://qkgmymeiszcznzplcgtc.supabase.co`

The browser still talks only to the Motion API. Pricing, owner access, quote status, order transitions and payments stay server-side.

## Connection strings — two of them

Supabase issues more than one URI. Using the wrong one is the usual failure.

| Use | Which URI | How to recognise it |
| --- | --- | --- |
| **Migrations** (`db/migrate.js`) — preferred | **Direct** | Host `db.<project-ref>.supabase.co`, port **5432**. Use this when IPv6 works. |
| **Migrations** and **persistent Node API** — IPv4 fallback | **Session Pooler** | Host `*.pooler.supabase.com`, port **exactly 5432**. Session mode gives the single `pg.Client` (migrations) or long-lived `pg.Pool` (API) an exclusive backend connection, so `pg_advisory_lock` is retained. |
| Never | **Transaction Pooler** | Port **6543**. Cannot hold advisory locks and fights `pg` prepared statements. The migration runner refuses it. |

Direct is preferred when IPv6 works. Many IPv4-only networks (including typical Windows home ISPs) cannot reach the Direct host. Session Pooler port 5432 is the supported fallback for both migrations and the API.

Dashboard → Project Settings → Database → Connection string. Enable `sslmode=require`.

Never commit a connection string, a service_role key, or a `.env.supabase` file.

## Rehearsal — empty project only

Create `.env.supabase` locally (gitignored) from `.env.example`:

```
DATABASE_URL=<Direct URI when IPv6 works, or Session Pooler :5432 on IPv4-only networks; sslmode=require>
SUPABASE_URL=https://qkgmymeiszcznzplcgtc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role JWT>
OWNER_ALLOWED_EMAILS=<two distinct addresses>
API_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
VITE_API_BASE_URL=http://localhost:8787/api
VITE_SUPABASE_URL=https://qkgmymeiszcznzplcgtc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
VITE_SUPABASE_GOOGLE=true
```

Then:

```sh
node --env-file=.env.supabase db/migrate.js --dry-run
node --env-file=.env.supabase db/migrate.js
```

`--dry-run` lists pending files and writes nothing. The apply step creates the Motion schema (migrations 0001–0014) on the empty project. It does **not** copy Neon data. There is no customer, product, order, quote or payment seed.

The runner refuses Transaction Pooler port **6543**. Direct and Session Pooler port **5432** are accepted.

Local API against that database:

```sh
node --env-file=.env.supabase server/dev.js
```

Frontend (same file, or a `.env` that shares the `VITE_*` values):

```sh
npm run dev
```

## What the migrations do

0001–0013 are the existing Motion schema and business rules. They are not rewritten for Supabase. 0014 enables row-level security on every `public` table **without FORCE**, so the Node API (database owner) still sees everything, while the Supabase `anon` / `authenticated` roles used by the Data API see nothing. It also creates Storage buckets when the `storage` schema is present.

Do not run these against the live Neon database. Do not run them as part of a Render deploy.

## Auth — console steps

In the Supabase dashboard for this project:

1. Authentication → Providers → Email: enable, **Confirm email** on, minimum password length 8.
2. Authentication → Providers → Google: enable; paste Google OAuth client id and secret. Do not put those in Git.
3. Authentication → URL Configuration:
   - Site URL: the frontend origin (`http://localhost:5173` locally; the Render HTTPS origin in production).
   - Redirect URLs: `http://localhost:5173/**`, `http://127.0.0.1:5173/**`, and later the Render frontend `https://<site>/**`.
4. Optionally disable the Data API / PostgREST public access. RLS already denies `anon`/`authenticated`; turning the API off is extra.

A Google-only owner who later sets a password at `/manager/activate` stays on **one account**. Confirmed email/password and Google identities that share an email are linked automatically by Supabase. The dashboard control for linking is **manual** linking; this app does not need it. Adding a password uses the password-reset / `updateUser` flow, not a second sign-up.

Do not create live Auth users from this repository or from an agent session.

## Storage — buckets, MIME, size, policies

Buckets (created by migration 0014 when `storage` exists, or by hand):

| Bucket | Public | Used for |
| --- | --- | --- |
| `motion-private` | no | `customer_artwork`, `design_proof` |
| `motion-public` | yes | `product_image`, `project_image`, `website_asset` |

Restrictions (also in `server/storage.js`):

- MIME: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Size: 1 byte … 25 MB
- Filenames must not contain `/` or `\`

Policies:

- `motion-public`: `SELECT` for `anon` and `authenticated` (catalogue images).
- `motion-private`: no policies for `anon`/`authenticated`. Listing and download require a signed URL issued by the API after an ownership check.
- No insert/update/delete policies for those roles. Writes use the service_role client.

The API still decides who may upload or fetch. RLS is defense in depth, not the pricing/order/admin control plane.

Uploads are **not** claimed complete until a real signed PUT and a signed GET have been verified in a browser against this project. Until the buckets exist, `createUploadUrl` fails honestly with `storage_not_configured` / `storage_unavailable`, and no orphan `media_assets` row is created.

## Render variables — names only

Do not fill these in during this task. Do not deploy.

**`motion-api`**

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_ALLOWED_EMAILS`
- `API_ALLOWED_ORIGINS` (Blueprint-wired)
- `API_TRUSTED_CLIENT_HEADER` (`none`)
- `NODE_ENV` (`production`)

**`motion-frontend`**

- `VITE_API_BASE_URL` (Blueprint-wired)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_GOOGLE`

## What this does not do

- Does not delete, disable, or dump the Neon project.
- Does not change live Render variables or trigger a deploy.
- Does not invent products, customers, orders, quotes, portfolio entries or payments.
- Does not expose Postgres or Storage to the browser as a data API.
