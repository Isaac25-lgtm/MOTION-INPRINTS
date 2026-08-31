# Motion — Design • Print • Brand

E-commerce and business-management platform for Motion, a Kampala printing, branding, signage and digital-solutions company.

Customers browse, configure, inquire, order, receive quotes and track jobs as guests. They never create accounts. Administrators sign in with server-owned usernames and passwords. Neon PostgreSQL is the only business database.

## Commands

```sh
npm install
npm run dev     # http://localhost:5173
npm run dev:api # http://127.0.0.1:8787/api
npm run build
npm test

# Applies db/migrations/*.sql in order.
# Prefers MIGRATION_DATABASE_URL (direct Neon). Falls back to a direct local DATABASE_URL.
# Pooled Neon URLs are rejected. See ENVIRONMENT.md.
node --env-file=.env db/migrate.js --dry-run
node --env-file=.env db/migrate.js

# Generate a scrypt hash for ADMIN_USERS_JSON. Hidden prompt only — never pass the password as an argument.
node scripts/hash-admin-password.js
```

## Structure

- `src/styles/` — design tokens and the CSS system. `tokens.css` is the single source of truth for colour, type, spacing, radius and motion.
- `src/components/ui/` — the component library: buttons, media frames, cards, forms, states, overlays, navigation.
- `src/pages/` — public pages plus the management dashboard at `/manager`.
- `src/layouts/` — header, footer, mobile drawer, search panel.
- `src/content/` — CMS content provider; business copy and contact details come from the database, never from constants.
- `src/services/` — API-only data access. No component talks to Postgres directly.
- `server/` — web-standard secure API handler, administrator sessions, validation, storage abstraction. Outside the browser bundle.
- `db/migrations/` — version-controlled Postgres schema and business-taxonomy seed.

## Documentation

| File | Covers |
| --- | --- |
| `ENVIRONMENT.md` | Every variable, Neon connections, administrator sessions |
| `DEPLOYMENT.md` | GitHub → Render, and the separate API runtime |
| `SCHEMA.md` | Database model, guest contacts, administrator sessions |
| `COMMERCE.md` | Pricing engine, cart, quotes, orders, payments |
| `BACKEND_READINESS.md` | Backend audit status and blockers |
| `GO_LIVE_AUDIT.md` | Production readiness verdict and blockers |
| `BACKLOG.md` | Prioritised post-launch work |
| `DESIGN_SYSTEM.md` | Art direction, tokens, typography, layout, motion |
| `PHOTOGRAPHY.md` | Image sourcing rules and media treatments |
| `VISUAL_REVIEW.md` | Mobile and art-direction audit findings |

## Before this can go live

**Real photography and business content.** The database currently holds the service taxonomy and empty CMS slots — no products, no projects, no contact details. Pages render honest empty states until those exist, by design.

The logo and brand colour are in place: the artwork was reconstructed from `motion logo.pdf` into `src/assets/`, and the brand blue (CMYK 82.7/38.4/11/0, sRGB `#1f80b9`) is set in `src/styles/tokens.css`. A **knockout logo for dark backgrounds** is the one remaining brand asset.

The source contains no invented prices, customers, orders, testimonials, statistics or credentials.

Object storage is not connected. Artwork must be sent directly until an S3-compatible provider is configured. Do not deploy this change to live Render until another engineer has audited the diff.
