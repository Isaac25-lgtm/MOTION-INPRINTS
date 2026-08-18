-- Owner role, and Digital Solutions leading the taxonomy.
--
-- Forward-only. Nothing here edits an applied migration: 0001 defined the role
-- CHECK and 0002 seeded the taxonomy, and both stay exactly as they were. This
-- file only ALTERs a constraint and UPDATEs rows, so re-running the suite from
-- scratch produces the same end state as upgrading an existing database.
--
-- Every statement is written to be safe if the data is already in the target
-- shape, because a migration that fails on second contact with reality is a
-- migration that blocks a deploy at the worst moment.

BEGIN;

-- ── 1. The owner role ───────────────────────────────────────────────────────
-- Two named people hold full dashboard rights. 'admin' was the old name for
-- that and is migrated rather than kept alongside: two words for one level of
-- access is how a permission check eventually tests the wrong one.
--
-- The constraint is replaced rather than widened permanently — 'admin' is NOT
-- carried forward, so nothing can write the retired value after this runs.

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Widen first so the UPDATE below cannot violate the constraint mid-transaction.
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('customer', 'admin', 'owner'));

UPDATE public.user_profiles SET role = 'owner', updated_at = now() WHERE role = 'admin';

-- Now narrow to the final vocabulary. Any row still holding 'admin' would fail
-- here, which is the point: the migration refuses to leave a mixed estate.
ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('customer', 'owner'));

COMMENT ON COLUMN public.user_profiles.role IS
  'customer = ordinary account. owner = full management access, granted only by the server-side staff bootstrap against OWNER_ALLOWED_EMAILS. Never set from a request body.';

-- ── 2. Digital Solutions leads ──────────────────────────────────────────────
-- Ordering lives in the data, not in a hand-sorted array in one component, so
-- homepage, shop, services, footer, search and the API all agree by default.

UPDATE public.categories SET sort_order = 10, updated_at = now() WHERE slug = 'digital-solutions';
UPDATE public.categories SET sort_order = 20, updated_at = now() WHERE slug = 'printing';
UPDATE public.categories SET sort_order = 30, updated_at = now() WHERE slug = 'signage';
UPDATE public.categories SET sort_order = 40, updated_at = now() WHERE slug = 'promotional-display';
UPDATE public.categories SET sort_order = 50, updated_at = now() WHERE slug = 'apparel';
UPDATE public.categories SET sort_order = 60, updated_at = now() WHERE slug = 'decor';
UPDATE public.categories SET sort_order = 70, updated_at = now() WHERE slug = 'design';

-- ── 3. Business Systems, broadened ──────────────────────────────────────────
-- Point-of-sale is one system Motion can build, not the whole of what it offers.
-- The slug changes with the name so the URL does not keep advertising the
-- narrower service; there are no live external links to preserve yet.

UPDATE public.categories
   SET name = 'Business Systems',
       slug = 'business-systems',
       description = 'Sales, stock, reporting and operational systems built to fit how a business already works. Scoped and quoted per project.',
       sort_order = 40,
       updated_at = now()
 WHERE slug = 'business-point-of-sale-systems';

-- ── 4. Digital Marketing ────────────────────────────────────────────────────
-- A real service under Digital Solutions. Quote-first: no package or price is
-- asserted, because none has been defined.

INSERT INTO public.categories (name, slug, parent_id, is_published, sort_order, description)
SELECT 'Digital Marketing', 'digital-marketing', parent.id, true, 30,
       'Campaigns, social content and paid promotion, planned around what the business actually sells. Scoped and quoted per project.'
  FROM public.categories parent
 WHERE parent.slug = 'digital-solutions'
   AND NOT EXISTS (SELECT 1 FROM public.categories existing WHERE existing.slug = 'digital-marketing');

-- Keep the remaining Digital Solutions children in a deliberate order.
UPDATE public.categories SET sort_order = 10, updated_at = now() WHERE slug = 'website-design';
UPDATE public.categories SET sort_order = 20, updated_at = now() WHERE slug = 'ecommerce-website-development';

COMMIT;
