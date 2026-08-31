-- Least-privilege login for the Render API.
--
-- The migration user remains the schema owner. Configure DATABASE_URL with the
-- motion_app role after setting its password in Neon; do not use the owner URL
-- for application traffic.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
    CREATE ROLE motion_app LOGIN NOINHERIT;
  END IF;
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO motion_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO motion_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO motion_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO motion_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO motion_app;

COMMENT ON ROLE motion_app IS
  'Runtime login for Motion API. DML only; schema changes use the migration owner.';

COMMIT;
