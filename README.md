# Motion — Design • Print • Brand

E-commerce and business-management platform for Motion, a Kampala printing, branding, signage and digital-solutions company.

## Commands

```sh
npm install
npm run dev     # http://localhost:5173
npm run build
npm test

# Applies db/migrations/*.sql in order; needs DATABASE_URL in the environment.
# Against Supabase, use the direct (non-pooled) URI — see SUPABASE.md.
node --env-file=.env.supabase db/migrate.js --dry-run
node --env-file=.env.supabase db/migrate.js
```

### Making someone an owner

Everyone who signs up is a `customer`. There is no HTTP route or UI control that grants `owner`. The normal path is the server-side allowlist:

1. Set `OWNER_ALLOWED_EMAILS` on the API (exactly two distinct addresses).
2. The owner signs in at `/manager` (Google or email/password) and confirms their email.
3. `POST /api/staff/bootstrap` upserts `user_profiles.role = owner`.

`scripts/promote-admin.js` remains as break-glass recovery and needs a shell plus `DATABASE_URL`. Full procedure in `ENVIRONMENT.md` and `SUPABASE.md`.

## Structure

- `src/styles/` — design tokens and the CSS system. `tokens.css` is the single source of truth for colour, type, spacing, radius and motion.
- `src/components/ui/` — the component library: buttons, media frames, cards, forms, states, overlays, navigation.
- `src/pages/` — public pages plus the implemented customer quotation list and detail experience. Other customer/admin screens remain phased placeholders.
- `src/layouts/` — header, footer, mobile drawer, search panel.
- `src/content/` — CMS content provider; business copy and contact details come from the database, never from constants.
- `src/services/` — API-only data access. No component talks to the backend or to Supabase Postgres directly.
- `server/` — web-standard secure API handler, Supabase Auth verification, validation, storage abstraction. Outside the browser bundle.
- `db/migrations/` — version-controlled Postgres schema and business-taxonomy seed.

## Documentation

| File | Covers |
| --- | --- |
| `SUPABASE.md` | Neon → Supabase rehearsal, connections, Auth/Storage console steps |
| `GO_LIVE_AUDIT.md` | Production readiness verdict and blockers |
| `BACKLOG.md` | Prioritised post-launch work |
| `COMMERCE.md` | Pricing engine, cart, quotes, orders, payments |
| `DESIGN_SYSTEM.md` | Art direction, tokens, typography, layout, motion |
| `PHOTOGRAPHY.md` | Image sourcing rules and media treatments |
| `VISUAL_REVIEW.md` | Mobile and art-direction audit findings |
| `ENVIRONMENT.md` | Every variable, and whether it is browser-safe |
| `DEPLOYMENT.md` | GitHub → Render, and the separate API runtime |
| `SCHEMA.md` | Database model, ERD, admin bootstrap |
| `BACKEND_READINESS.md` | Backend audit status and blockers |

## Before this can go live

**Real photography and business content.** The database currently holds the service taxonomy and empty CMS slots — no products, no projects, no contact details. Pages render honest empty states until those exist, by design.

The logo and brand colour are in place: the artwork was reconstructed from `motion logo.pdf` into `src/assets/`, and the brand blue (CMYK 82.7/38.4/11/0, sRGB `#1f80b9`) is set in `src/styles/tokens.css`. A **knockout logo for dark backgrounds** is the one remaining brand asset.

The source contains no invented prices, customers, orders, testimonials, statistics or credentials.

See `SUPABASE.md` for the Auth, database and Storage cutover. Neon is left running until that cutover is deliberately completed.
