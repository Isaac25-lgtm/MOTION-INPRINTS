# Environment configuration

Copy `.env.example` to `.env` for local development. `.env` is ignored by Git. Vite can only expose variables beginning with `VITE_`; do not add secret values with that prefix.

| Variable | Purpose | Exposure | Local configuration | Production configuration |
| --- | --- | --- | --- | --- |
| `VITE_APP_NAME` | Browser display name | Browser-safe | `.env` | Render Static Site environment group/service |
| `VITE_APP_URL` | Public frontend URL | Browser-safe | `.env` | Render Static Site |
| `VITE_API_BASE_URL` | Base URL of the secure API | Browser-safe | `.env` | Render Static Site |
| `VITE_NEON_AUTH_URL` | Neon Auth base URL — the only auth value the browser needs. Neon Console → Auth → Configuration. Include the full path (`…/neondb/auth`), not just the host. | **Public** | `.env` | Render Static Site / Neon branch config |
| `VITE_NEON_AUTH_GOOGLE` | Set to `false` to hide "Continue with Google". Anything else (or unset) shows it. Google is enabled per-project in the Neon console and the browser cannot detect it, so it is declared. | **Public** | `.env` (may be blank) | Render Static Site |
| `DATABASE_URL` | Neon Postgres connection string | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `NEON_AUTH_JWKS_URL` | Public keys for token verification. The Auth URL **plus** `/.well-known/jwks.json`. | Server-only (not secret, but unused by the browser) | API runtime `.env` | secure API/Neon runtime only |
| `NEON_AUTH_ISSUER` | Expected `iss` claim. The **origin** of the Auth URL, with **no path**. | Server-only (not secret) | API runtime `.env` | secure API/Neon runtime only |
| `API_ALLOWED_ORIGINS` | Comma-separated permitted frontend origins | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `API_TRUSTED_CLIENT_HEADER` | Header the API runtime overwrites with the real client address, used as the rate-limit identity. **Required in production** — the server refuses to start without it when `NODE_ENV=production`. Never name a header a client can forge. | Server-only | API runtime `.env` (may be blank) | secure API/Neon runtime only |
| `API_REQUEST_TIMEOUT_MS` | Upstream request timeout | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX_REQUESTS` | Rate-limit policy settings | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `API_RATE_LIMIT_MAX_KEYS` | Maximum in-memory fallback rate-limit buckets | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `OBJECT_STORAGE_*` | Storage endpoint, bucket, credentials and signing | Server-only | API runtime `.env` | secure API/Neon runtime only |
| `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_API_KEY` | Future payment verification/provider access | Server-only | API runtime `.env` | secure API/Neon runtime only |

`DATABASE_URL`, storage keys, signing keys, payment secrets, and any service credential must never be placed in the React application, Git, documentation examples, or Render's static build environment.

For production, `VITE_API_BASE_URL` must be an absolute HTTPS API URL; `/api` is only valid when a local development proxy exists. A Render Static Site cannot execute `server/index.js`.

---

# Neon Auth

Motion uses **Neon Auth (Managed Better Auth)**, integrated through the official `@neondatabase/neon-js` SDK.

This replaced an earlier integration written against **Stack Auth** — `VITE_NEON_AUTH_PROJECT_ID`, `VITE_NEON_AUTH_PUBLISHABLE_KEY`, `x-stack-*` headers and `/api/v1/auth/...` endpoints. None of that exists in Neon Auth. Those two variables are now rejected at startup rather than ignored, so a stale environment fails loudly instead of producing a login form that cannot work.

## The three values, and the one that is easy to get wrong

For the auth URL `https://ep-xxxx.neonauth.<region>.aws.neon.tech/neondb/auth`:

| | Value |
| --- | --- |
| `VITE_NEON_AUTH_URL` | `https://ep-xxxx.neonauth.<region>.aws.neon.tech/neondb/auth` |
| `NEON_AUTH_JWKS_URL` | the same, **plus** `/.well-known/jwks.json` |
| `NEON_AUTH_ISSUER` | `https://ep-xxxx.neonauth.<region>.aws.neon.tech` — **origin only, no path** |

The issuer is the origin, **not** the auth URL. Pasting the auth URL into both is the likely mistake: tokens then verify cryptographically and fail on the issuer claim, which looks like a broken login rather than a misconfiguration. `serverConfig()` therefore validates the pair on boot and refuses to start, and `tests/auth.test.js` pins the behaviour.

## How a session works

1. The SDK signs in against the Neon Auth origin, which sets an **HTTP-only** `__Secure-neonauth.session_token` cookie. Script cannot read it, so an XSS cannot steal the durable credential. **Nothing is stored in `localStorage`** — the previous integration kept a long-lived refresh token there.
2. Our API is a different origin and never receives that cookie. The client calls `authClient.token()` to mint a **short-lived EdDSA JWT**, sent as a bearer token and cached in memory for 60s.
3. `server/auth.js` verifies it against the JWKS with `algorithms: ['EdDSA']` pinned, then loads the role from `public.user_profiles`.

**The role always comes from our database, never from the token.** A Neon Auth user object carries its own `role` field — that is Better Auth's, unrelated to Motion's, and is ignored. A test asserts that a token claiming `role: admin` still gets 403 when the stored profile says `customer`.

## Trusted origins — required, and currently incomplete

Neon Auth rejects requests from unregistered origins with `INVALID_ORIGIN` **before any credential is checked**. Verified against the live project on 15 August 2026:

| Origin | Status |
| --- | --- |
| `http://localhost:5173` | ✅ accepted |
| `http://127.0.0.1:5173` | ❌ **rejected** — must be added |

Both must be registered, because they are different origins to a browser and the dev server binds both. **Add `http://127.0.0.1:5173` in the Neon Console → Auth → Configuration → Trusted origins / redirect domains.**

No production domain is assumed here. **The exact Render HTTPS frontend URL must be added before production deployment**, or sign-in fails there in the same way.

## Email verification is enabled

Confirmed against the live project: sign-up succeeds but issues **no session**, and the first sign-in returns `EMAIL_NOT_VERIFIED` until the emailed link is followed. The interface handles this as its own state with a resend action, rather than reporting it as a wrong password.

If you would rather not require it, turn it off in the Neon console — the code handles both, since `signUp` reports whether a session was issued.

## Email and password is a first-class method

The sign-up page offers two equal choices: **Continue with Google**, or **create an account with email and password**.

"Email" means any address the customer can receive mail at — Outlook, Hotmail, Yahoo, Proton, a company address, a school address, or a Gmail address for someone who would rather hold a separate Motion password than sign in with Google. Nothing in the interface says "Gmail" or requires a Google account.

There is no username-only account type, deliberately: password recovery, verification, proof notifications and order updates all need a reachable address.

## Google

Google is enabled on this project using **Neon's shared development keys**, which is fine for development. For production you may register your own Google OAuth credentials so the consent screen shows Motion's name and branding rather than Neon's, and so the app is not subject to shared-key rate limits. That is a Neon console change and needs no code change here.

No Google client secret exists in this repository, and none should.

## Owner bootstrap

Everyone who signs up is a `customer`. There is no HTTP route, UI control, environment variable or automatic first-user rule that grants `admin` — promotion is a server-only script requiring database access.

```bash
# 1. The owner signs up and signs in ONCE, so the app creates their profile row.

# 2. Find the exact Neon Auth user id — Neon Console → Auth → Users, or:
#      SELECT id, email FROM neon_auth."user" ORDER BY "createdAt" DESC LIMIT 10;

# 3. Promote that exact id:
node --env-file=.env scripts/promote-admin.js <auth_user_id>

# 4. Sign out and back in — the browser caches the profile for the session.
```

Supporting commands:

```bash
node --env-file=.env scripts/promote-admin.js --list              # existing profiles and roles
node --env-file=.env scripts/promote-admin.js <auth_user_id> --demote
```

The script takes an **exact `auth_user_id`** — never "the earliest profile", an email, or a name. Every convenience alternative promotes the wrong account the day two people sign up in the same minute. It **refuses to run if no matching profile exists** and never creates one, and it reports exactly which profile changed.

## What still needs doing in the Neon console

1. **Add `http://127.0.0.1:5173`** to trusted origins — verified missing.
2. **Add the Render HTTPS frontend URL** before production deployment.
3. Optionally replace Neon's shared Google keys with Motion's own for production branding.
4. Confirm whether email verification should stay on.
