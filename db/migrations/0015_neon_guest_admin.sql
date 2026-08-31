-- Guest contacts, administrator sessions, and Neon-only database access.
--
-- Forward-only. Migrations 0001–0014 are unchanged. user_profiles and the
-- existing customer_id columns stay in place for rollback; application code
-- must stop reading and writing them.
--
-- customer_contacts are operational records, not accounts. Guests never receive
-- credentials, sessions, or login identifiers. Email is contact information.

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  original_email text NOT NULL,
  normalized_email text NOT NULL,
  phone text,
  company_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_contacts_normalized_email_format
    CHECK (normalized_email = lower(btrim(normalized_email))),
  CONSTRAINT customer_contacts_original_email_present
    CHECK (btrim(original_email) <> ''),
  CONSTRAINT customer_contacts_display_name_present
    CHECK (btrim(display_name) <> '')
);

COMMENT ON TABLE public.customer_contacts IS
  'Guest operational contacts. Not accounts: no credentials, sessions, or authentication identifiers. Email is contact information only.';
COMMENT ON COLUMN public.customer_contacts.normalized_email IS
  'lower(trim(original_email)). Unique so checkout and inquiry upsert by email. Never an authentication identifier.';
COMMENT ON COLUMN public.customer_contacts.original_email IS
  'Email as submitted on the order or inquiry. Historical snapshots on those rows are not rewritten.';

CREATE UNIQUE INDEX IF NOT EXISTS customer_contacts_normalized_email_uidx
  ON public.customer_contacts (normalized_email);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.customer_contacts(id);

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.customer_contacts(id);

COMMENT ON COLUMN public.orders.contact_id IS
  'Guest contact for this order. The contact_* snapshot columns remain the historical record and are not rewritten.';
COMMENT ON COLUMN public.quote_requests.contact_id IS
  'Guest contact for this inquiry. The contact_* snapshot columns remain the historical record and are not rewritten.';

-- Backfill contacts from existing snapshots without modifying those snapshots.
INSERT INTO public.customer_contacts (display_name, original_email, normalized_email, phone, company_name, last_seen_at)
SELECT DISTINCT ON (lower(btrim(source.email)))
  COALESCE(NULLIF(btrim(source.name), ''), btrim(source.email)),
  btrim(source.email),
  lower(btrim(source.email)),
  NULLIF(btrim(source.phone), ''),
  NULLIF(btrim(source.company), ''),
  source.seen_at
FROM (
  SELECT contact_name AS name, contact_email AS email, contact_phone AS phone, company_name AS company, created_at AS seen_at
  FROM public.orders
  WHERE contact_email IS NOT NULL AND btrim(contact_email) <> ''
  UNION ALL
  SELECT contact_name, contact_email, contact_phone, NULL, created_at
  FROM public.quote_requests
  WHERE contact_email IS NOT NULL AND btrim(contact_email) <> ''
) AS source
ORDER BY lower(btrim(source.email)), source.seen_at DESC
ON CONFLICT (normalized_email) DO NOTHING;

UPDATE public.orders o
SET contact_id = c.id
FROM public.customer_contacts c
WHERE o.contact_id IS NULL
  AND o.contact_email IS NOT NULL
  AND c.normalized_email = lower(btrim(o.contact_email));

UPDATE public.quote_requests q
SET contact_id = c.id
FROM public.customer_contacts c
WHERE q.contact_id IS NULL
  AND q.contact_email IS NOT NULL
  AND c.normalized_email = lower(btrim(q.contact_email));

CREATE INDEX IF NOT EXISTS orders_contact_id_idx ON public.orders (contact_id);
CREATE INDEX IF NOT EXISTS quote_requests_contact_id_idx ON public.quote_requests (contact_id);

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  administrator_id uuid NOT NULL,
  username text NOT NULL,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT admin_sessions_token_hash_sha256 CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT admin_sessions_expires_after_create CHECK (expires_at > created_at),
  CONSTRAINT admin_sessions_username_present CHECK (btrim(username) <> '')
);

COMMENT ON TABLE public.admin_sessions IS
  'Opaque administrator sessions. Only SHA-256 token hashes are stored. administrator_id is the stable UUID from ADMIN_USERS_JSON.';
COMMENT ON COLUMN public.admin_sessions.username IS
  'Username snapshot at issuance. Not an authentication lookup key after the session exists.';
COMMENT ON COLUMN public.admin_sessions.administrator_id IS
  'Stable administrator UUID from ADMIN_USERS_JSON. Used as actorId in application code and written into existing *_auth_user_id audit columns.';

CREATE UNIQUE INDEX IF NOT EXISTS admin_sessions_token_hash_uidx ON public.admin_sessions (token_hash);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx
  ON public.admin_sessions (expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS admin_sessions_administrator_idx ON public.admin_sessions (administrator_id);

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  username_hash text PRIMARY KEY,
  failed_count integer NOT NULL DEFAULT 0,
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  CONSTRAINT admin_login_attempts_hash_sha256 CHECK (username_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT admin_login_attempts_failed_count_nonnegative CHECK (failed_count >= 0),
  CONSTRAINT admin_login_attempts_failed_count_bounded CHECK (failed_count <= 10000)
);

COMMENT ON TABLE public.admin_login_attempts IS
  'Per-username login throttling. The key is SHA-256 of the normalized username so attempt state never stores the username itself.';

CREATE INDEX IF NOT EXISTS admin_login_attempts_locked_until_idx
  ON public.admin_login_attempts (locked_until)
  WHERE locked_until IS NOT NULL;

-- Database access is only through the Motion API. Disable the Supabase Data API
-- RLS configuration from 0014; there is no PostgREST surface on Neon.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'motion_public_read'
  ) THEN
    EXECUTE 'DROP POLICY motion_public_read ON storage.objects';
  END IF;
END
$$;

COMMIT;
