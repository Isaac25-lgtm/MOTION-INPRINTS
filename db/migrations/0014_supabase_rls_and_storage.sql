-- Defense in depth for the Supabase Data API (PostgREST).
--
-- Motion's Node API is the authority for prices, quotes, orders, proofs and
-- owner access. It connects as the database owner / superuser and is therefore
-- unaffected by row-level security (RLS is enabled, not FORCED).
--
-- `anon` and `authenticated` — the roles the publishable key uses against
-- PostgREST — see no rows. There are no policies. Direct browser access to
-- Postgres, even with a valid user JWT, cannot read customer data, quotes,
-- proofs, orders, artwork metadata or admin records.
--
-- Historical migrations 0001–0013 are unchanged. This file only adds RLS,
-- optional Storage buckets (when the `storage` schema exists), and a comment
-- that identity now lives with the authentication provider rather than Neon.

COMMENT ON COLUMN public.user_profiles.auth_user_id IS
  'Identity UUID issued by the authentication provider; credentials remain with that provider.';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;
  END IF;
END
$$;

-- Storage buckets. Skipped on a local Postgres that has no `storage` schema.
-- Policies: public catalogue images are readable; private artwork/proofs are
-- not. All writes go through the service_role client in the Motion API.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES
    (
      'motion-private',
      'motion-private',
      false,
      26214400,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    ),
    (
      'motion-public',
      'motion-public',
      true,
      26214400,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'motion_public_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY motion_public_read
        ON storage.objects
        FOR SELECT
        TO anon, authenticated
        USING (bucket_id = 'motion-public')
    $policy$;
  END IF;
END
$$;
