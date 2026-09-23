-- Motion websites: operational submissions.
-- Shared by both sites; every table that either site writes carries `site`.
-- Catalogue content stays in code. No payment or card data is ever stored.

CREATE TABLE IF NOT EXISTS orders (
  id            BIGSERIAL PRIMARY KEY,
  reference     TEXT NOT NULL UNIQUE,
  site          TEXT NOT NULL DEFAULT 'imprints' CHECK (site IN ('imprints')),
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'contacted', 'quoted', 'confirmed', 'completed', 'cancelled')),
  name          TEXT NOT NULL,
  organisation  TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL,
  whatsapp      TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  location      TEXT NOT NULL,
  deadline      DATE,
  notes         TEXT NOT NULL DEFAULT '',
  source_path   TEXT NOT NULL DEFAULT '',
  referrer      TEXT NOT NULL DEFAULT '',
  utm_source    TEXT NOT NULL DEFAULT '',
  utm_medium    TEXT NOT NULL DEFAULT '',
  utm_campaign  TEXT NOT NULL DEFAULT '',
  utm_term      TEXT NOT NULL DEFAULT '',
  utm_content   TEXT NOT NULL DEFAULT '',
  notified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

-- Immutable snapshots of what was requested, taken from the catalogue at the
-- moment of submission. Later catalogue edits never rewrite history.
CREATE TABLE IF NOT EXISTS order_items (
  id            BIGSERIAL PRIMARY KEY,
  order_id      BIGINT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  position      SMALLINT NOT NULL,
  product_slug  TEXT NOT NULL,
  product_title TEXT NOT NULL,
  unit          TEXT NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
  options       JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes         TEXT NOT NULL DEFAULT '',
  -- Only filled when a verified fixed price exists; quotation items stay NULL.
  price_snapshot_ugx NUMERIC(14, 2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, position)
);

CREATE TABLE IF NOT EXISTS inquiries (
  id            BIGSERIAL PRIMARY KEY,
  reference     TEXT NOT NULL UNIQUE,
  site          TEXT NOT NULL CHECK (site IN ('imprints', 'technologies')),
  topic         TEXT NOT NULL,
  subject       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'contacted', 'closed')),
  name          TEXT NOT NULL,
  organisation  TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL,
  whatsapp      TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  location      TEXT NOT NULL DEFAULT '',
  message       TEXT NOT NULL,
  context       JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_path   TEXT NOT NULL DEFAULT '',
  referrer      TEXT NOT NULL DEFAULT '',
  utm_source    TEXT NOT NULL DEFAULT '',
  utm_medium    TEXT NOT NULL DEFAULT '',
  utm_campaign  TEXT NOT NULL DEFAULT '',
  utm_term      TEXT NOT NULL DEFAULT '',
  utm_content   TEXT NOT NULL DEFAULT '',
  notified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiries_site_created_idx ON inquiries (site, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback (
  id            BIGSERIAL PRIMARY KEY,
  site          TEXT NOT NULL CHECK (site IN ('imprints', 'technologies')),
  category      TEXT NOT NULL DEFAULT 'general',
  message       TEXT NOT NULL,
  contact       TEXT NOT NULL DEFAULT '',
  source_path   TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI assistant handoffs. A short summary the visitor approved, never the full
-- conversation.
CREATE TABLE IF NOT EXISTS chat_leads (
  id              BIGSERIAL PRIMARY KEY,
  reference       TEXT NOT NULL UNIQUE,
  site            TEXT NOT NULL CHECK (site IN ('imprints', 'technologies')),
  summary         TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  handoff_status  TEXT NOT NULL DEFAULT 'new'
                  CHECK (handoff_status IN ('new', 'contacted', 'closed')),
  source_path     TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
