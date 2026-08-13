# Motion — Design • Print • Brand

Production foundation for Motion's Kampala printing, branding, signage, and digital-solutions platform.

## Commands

```sh
npm install
npm run dev
npm run build
npm test
```

## Structure

- `src/` — React routes, layouts, shared UI foundations, config, and API-only service modules.
- `server/` — web-standard secure API handler, JWT authorization, validation, and storage abstraction. It is intentionally outside the browser bundle.
- `db/migrations/` — version-controlled Neon Postgres schema and genuine business-taxonomy seed migration.
- `ENVIRONMENT.md`, `DEPLOYMENT.md`, `SCHEMA.md` — operational documentation.

The source contains no business prices, customers, orders, testimonials, statistics, or secrets. The current UI is intentionally placeholder-only until the visual design phase.
