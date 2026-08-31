-- Least-privilege login for the Render API.
--
-- The migration user remains the schema owner. Before applying this migration,
-- create motion_app as a login with a strong password in the Neon Console. The
-- password must never be stored in a migration or committed to the repository.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Required Neon role motion_app does not exist.',
      HINT = 'Create motion_app as a login with a strong password in the Neon Console, then rerun migrations.';
  END IF;

  IF NOT (SELECT rolcanlogin FROM pg_roles WHERE rolname = 'motion_app') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Required Neon role motion_app cannot log in.',
      HINT = 'Enable login and set a strong password for motion_app in the Neon Console, then rerun migrations.';
  END IF;
END
$$;

ALTER ROLE motion_app NOINHERIT;

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
