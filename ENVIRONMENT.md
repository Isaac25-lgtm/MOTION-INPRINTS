# Environment configuration

Copy `.env.example` to `.env` for local development. For Supabase rehearsals, copy it to `.env.supabase` and point `DATABASE_URL` at the **direct** connection (see `SUPABASE.md`). Both files are ignored by Git. Vite can only expose variables beginning with `VITE_`; do not add secret values with that prefix.

| Variable | Purpose | Exposure | Local configuration | Production configuration |
| --- | --- | --- | --- | --- |
| `VITE_APP_NAME` | Browser display name | Browser-safe | `.env` | Render Static Site |
| `VITE_APP_URL` | Public frontend URL | Browser-safe | `.env` | Render Static Site |
| `VITE_API_BASE_URL` | Base URL of the secure API | Browser-safe | `.env` | Render Static Site |
| `VITE_SUPABASE_URL` | Supabase project origin, no path | **Public** | `.env` | Render Static Site |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key | **Public** | `.env` | Render Static Site |
| `VITE_SUPABASE_GOOGLE` | Set to `false` to hide "Continue with Google". Anything else (or unset) shows it. | **Public** | `.env` (may be blank) | Render Static Site |
| `VITE_STORAGE_PUBLIC_BASE_URL` | Optional override for public catalogue images. Blank derives `{VITE_SUPABASE_URL}/storage/v1/object/public/motion-public` | **Public** | `.env` (may be blank) | Render Static Site (optional) |
| `DATABASE_URL` | Postgres connection string | Server-only | API runtime `.env` — direct URI for migrations, session pooler for the API | `motion-api` only |
| `SUPABASE_URL` | Same public origin as `VITE_SUPABASE_URL` | Server-only (not secret) | API runtime `.env` | `motion-api` only |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role JWT | **SECRET** | API runtime `.env` | `motion-api` only |
| `OWNER_ALLOWED_EMAILS` | Exactly two owner addresses | **SECRET-ish, server-only** | API runtime `.env` | `motion-api` only |
| `API_ALLOWED_ORIGINS` | Comma-separated permitted frontend origins | Server-only | API runtime `.env` | `motion-api` (wired from the frontend URL) |
| `API_TRUSTED_CLIENT_HEADER` | Header the API runtime overwrites with the real client address, used as the rate-limit identity. **Required in production** — the server refuses to start without it when `NODE_ENV=production`. Never name a header a client can forge. Literal `none` is the Render decision. | Server-only | API runtime `.env` (may be blank) | `motion-api` (`none`) |
| `API_REQUEST_TIMEOUT_MS` | Upstream request timeout | Server-only | API runtime `.env` | `motion-api` |
| `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX_REQUESTS` | Rate-limit policy settings | Server-only | API runtime `.env` | `motion-api` |
| `API_RATE_LIMIT_MAX_KEYS` | Maximum in-memory fallback rate-limit buckets | Server-only | API runtime `.env` | `motion-api` |
| `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_API_KEY` | Future payment verification/provider access | Server-only | API runtime `.env` | `motion-api` |

`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, storage credentials, payment secrets, and any service credential must never be placed in the React application, Git, documentation examples, or Render's static build environment.

For production, `VITE_API_BASE_URL` must be an absolute HTTPS API URL; `/api` is only valid when a local development proxy exists. A Render Static Site cannot execute `server/index.js`.

Obsolete names that must not be set: `VITE_NEON_AUTH_URL`, `VITE_NEON_AUTH_GOOGLE`, `VITE_NEON_AUTH_VERIFICATION`, `VITE_NEON_AUTH_PROJECT_ID`, `VITE_NEON_AUTH_PUBLISHABLE_KEY`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_ISSUER`. The app refuses to start if the `VITE_NEON_*` names are still present.

---

# Supabase Auth

Motion uses **Supabase Auth** through `@supabase/supabase-js`. The browser talks to Auth only to establish a session. Every business request still goes to the Motion API with a bearer token; the API asks Supabase `auth.getUser(token)` and then reads `public.user_profiles`.

## The three browser values

| | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` — origin only, no path |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the publishable / anon key |
| `VITE_SUPABASE_GOOGLE` | `true` (or unset) to show Google; `false` to hide it |

The matching server pair is `SUPABASE_URL` (same origin) and `SUPABASE_SERVICE_ROLE_KEY` (the **service_role** JWT, never the publishable key). `serverConfig()` refuses to start if the service_role slot contains an anon key.

## How a session works

1. supabase-js signs in (email/password or Google PKCE). It holds the session; Motion does not put tokens in `localStorage` itself.
2. Our API is a different origin. The client calls `authClient.token()` to read `session.access_token`, sent as a bearer token and cached in memory for 60s.
3. `server/auth.js` calls `supabase.auth.getUser(token)`, then loads the role from `public.user_profiles`.

**The role always comes from our database, never from the token.** A Supabase user can carry `app_metadata.role` — that is ignored. A test asserts that a token/user claiming `role: admin` still gets 403 when the stored profile says `customer`.

## Redirect URLs — required

Supabase rejects unregistered redirect URLs. Add all of these under Authentication → URL Configuration:

| Origin | Status |
| --- | --- |
| `http://localhost:5173/**` | required for local Vite |
| `http://127.0.0.1:5173/**` | required — a different origin to a browser |
| The Render HTTPS frontend URL, with `/**` | required before production sign-in works |

Site URL should be the frontend origin.

## Email confirmation is expected

Sign-up succeeds but issues **no session**, and the first sign-in returns `email_not_confirmed` until the emailed link is followed. The interface handles this as its own state with a resend action, rather than reporting it as a wrong password.

Enable **Confirm email** in Authentication → Providers → Email.

## Email and password is a first-class method

The sign-up page offers two equal choices: **Continue with Google**, or **create an account with email and password**.

"Email" means any address the customer can receive mail at. Nothing in the interface says "Gmail" or requires a Google account.

There is no username-only account type, deliberately: password recovery, verification, proof notifications and order updates all need a reachable address.

## Google

Enable the Google provider in the Supabase dashboard and paste the Google client id/secret there. No Google client secret exists in this repository, and none should.

A person who first used Google and later sets a password at `/manager/activate` keeps **one account**. Confirmed email/password and Google identities that share an email are linked automatically by Supabase. Do not turn on a dashboard “automatic linking” setting — that is for **manual** linking, which this app does not use. The activate page uses password reset on the existing user, never a second sign-up.

## Guest-first, and who may manage

**Customers never need an account.** Browsing, configuring, cart, checkout, quote and custom-project requests, artwork and order tracking all work with no session. An account adds saved details, history, proof approvals and reordering — nothing more. `tests/guest-first.test.js` fails if a guard is ever added to a purchase route.

**Management lives at `/manager`**, unlinked from the header, footer, customer account area and navigation. `/admin` redirects there for old links. The hiding is not the protection: every management API independently verifies the session and the stored role, so knowing the URL gains an unauthorised visitor nothing.

### How an owner is authorised

| Variable | Exposure | Value |
| --- | --- | --- |
| `OWNER_ALLOWED_EMAILS` | **Server-only, `motion-api` only** | Exactly two comma-separated owner addresses |

### The one manual Render step

**Set `OWNER_ALLOWED_EMAILS` on the `motion-api` service, with the two real owner addresses, before anyone tries to sign in at `/manager`.** It is declared `sync: false`, so a Blueprint sync prompts for it.

Format: `first@example.com,second@example.com` — a placeholder here, never the real values in any document or commit.

It must be **exactly two distinct, well-formed addresses**. Missing, blank, one, three, duplicated or malformed all resolve to an empty list, which approves nobody. A half-configured allowlist must never mean "approve whoever is left".

**A missing or broken value never breaks the public site.** It does not throw and does not stop the API: customers browse, configure, order, request quotes and track normally. Only `POST /api/staff/bootstrap` reports it, as a neutral `503 staff_configuration_unavailable` that names no address and confirms nothing about who is approved.

Never give it a `VITE_` name and never add it to the static site — everything there ships to the browser. A test walks `src/` and fails if the name appears anywhere in frontend source.

The chain, in order:

1. The owner signs in at `/manager` with **Google or email and password** — their own identity, never a shared login.
2. The browser calls `POST /api/staff/bootstrap` **with no arguments**.
3. The server resolves the email from **Supabase Auth `getUser(token)`**. Not from the request body, and not from a token claim parsed in this process.
4. The address must be **confirmed** and on the allowlist. Without the confirmation check, anyone could register an owner's address they do not control and wait to be elevated.
5. Only then is the profile created, or an existing customer profile **upgraded in place**. The write is an upsert on a unique `auth_user_id`, so repeated sign-ins can never duplicate it.
6. The grant is recorded in `admin_audit_log`.

Anyone else gets one neutral message — *"This account is not authorised for Motion staff access"* — identical for an unknown address, an unverified one and an ordinary customer. Nothing is created and no role is changed.

**Google proves identity only.** It never grants access on its own.

## Break-glass promotion

Everyone who signs up is a `customer`. There is no HTTP route, UI control or automatic first-user rule that grants `owner`. The staff bootstrap is the normal path. `scripts/promote-admin.js` remains for recovery when the allowlist is wrong:

```bash
node --env-file=.env scripts/promote-admin.js --list
node --env-file=.env scripts/promote-admin.js <auth_user_id>
node --env-file=.env scripts/promote-admin.js <auth_user_id> --demote
```

It takes an exact `auth_user_id` from Supabase Dashboard → Authentication → Users, refuses to run if no matching profile exists, never creates one, and reports exactly which profile changed.

## Real-browser test checklist

Automated tests cover token verification, role enforcement and the onboarding form. These are the paths that need a real browser and a real inbox — none can be proven headlessly. **The migration is not live until these pass against the Supabase project.**

Run at **`http://localhost:5173`**.

| # | Check | Pass when |
| --- | --- | --- |
| 1 | **Sign up with a non-Gmail address** | Account is created; the page says to confirm your email rather than claiming you are signed in |
| 2 | **Email confirmation** | The emailed link works; signing in before it fails with "confirm your email address first" and a resend action, not a wrong-password message |
| 3 | **First profile** | After the first sign-in you land on Account → Profile showing **"Complete your profile"**. Saving succeeds and the account nav appears |
| 4 | **Customer access** | `/account`, `/account/orders`, `/account/quotes` all load |
| 5 | **Google sign-in** | "Continue with Google" completes and returns signed in; a brand-new Google account is sent to the profile form as in 3 |
| 6 | **Owner bootstrap** | An allowlisted, confirmed address signing in at `/manager` reaches `/manager/dashboard` |
| 7 | **Customer denial** | From a second, unpromoted account, `/manager/dashboard` redirects to `/account`, and `GET /api/admin/products` returns **403** |
| 8 | **Guest purchase** | Cart, checkout, quote request, custom project and order tracking work signed out |

Check 7 matters most: 6 proves the grant works, 7 proves it is a grant rather than an open door. Test it with the browser devtools network tab, not only the redirect — the redirect is rendering, the 403 is the security.
