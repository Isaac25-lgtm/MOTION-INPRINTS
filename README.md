# Motion — Design • Print • Brand

E-commerce and business-management platform for Motion, a Kampala printing, branding, signage and digital-solutions company.

## Commands

```sh
npm install
npm run dev     # http://localhost:5173
npm run build
npm test

# Applies db/migrations/*.sql in order; needs DATABASE_URL in the environment.
node db/migrate.js --dry-run
node db/migrate.js
```

## Structure

- `src/styles/` — design tokens and the CSS system. `tokens.css` is the single source of truth for colour, type, spacing, radius and motion.
- `src/components/ui/` — the component library: buttons, media frames, cards, forms, states, overlays, navigation.
- `src/pages/` — public pages plus the implemented customer quotation list and detail experience. Other customer/admin screens remain phased placeholders.
- `src/layouts/` — header, footer, mobile drawer, search panel.
- `src/content/` — CMS content provider; business copy and contact details come from the database, never from constants.
- `src/services/` — API-only data access. No component talks to the backend directly.
- `server/` — web-standard secure API handler, JWT authorization, validation, storage abstraction. Outside the browser bundle.
- `db/migrations/` — version-controlled Neon Postgres schema and business-taxonomy seed.

## Documentation

| File | Covers |
| --- | --- |
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

See `BACKEND_READINESS.md` for the outstanding infrastructure blockers (Neon Auth, API runtime, object storage).
