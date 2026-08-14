-- Production portfolio and controlled CMS (Prompts 7.1, 7.2, 7.4).

-- ── Portfolio ───────────────────────────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN project_type text CHECK (project_type IS NULL OR project_type IN
    ('signage', 'printing', 'branding', 'apparel', 'promotional', 'decor', 'website', 'ecommerce', 'pos', 'other')),
  ADD COLUMN introduction text,
  ADD COLUMN scope_of_work text,
  ADD COLUMN display_priority integer NOT NULL DEFAULT 0,
  -- A client's name is theirs. It is published only when explicitly permitted,
  -- so the safe state is the default state (Prompt 7.1).
  ADD COLUMN show_client_name boolean NOT NULL DEFAULT false,
  -- Where the work was found during cataloguing, for internal provenance only.
  -- Never rendered publicly (Prompt 7.2).
  ADD COLUMN source_reference text,
  ADD COLUMN media_approved boolean NOT NULL DEFAULT false;

CREATE INDEX projects_priority_idx
  ON public.projects(is_featured DESC, display_priority DESC, completed_on DESC)
  WHERE is_published;

CREATE INDEX projects_type_idx ON public.projects(project_type) WHERE is_published;

-- Orientation lets the editorial grid compose from real media rather than
-- forcing every project into one ratio.
-- `width` and `height` already exist from migration 0001.
ALTER TABLE public.media_assets
  ADD COLUMN orientation text CHECK (orientation IS NULL OR orientation IN ('landscape', 'portrait', 'square')),
  -- Screenshots of digital work are a different kind of image from a photograph
  -- of a fabricated sign, and are composed differently.
  ADD COLUMN media_kind text NOT NULL DEFAULT 'photograph'
    CHECK (media_kind IN ('photograph', 'screenshot_desktop', 'screenshot_mobile', 'artwork', 'document'));

-- Replacing a low-resolution image must not change a project's URLs, so media is
-- versioned by row rather than by key: a replacement is a new asset linked in the
-- same slot, and the old row is retired (Prompt 7.2).
ALTER TABLE public.project_media
  ADD COLUMN replaced_by_media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN retired_at timestamptz;

-- ── Relationships (Prompt 7.3) ─────────────────────────────────────────────
-- Related work is derived from explicit relationships, never inferred.
CREATE TABLE public.project_products (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, product_id)
);

CREATE TABLE public.project_services (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, category_id)
);

-- ── CMS: publishing and scheduling (Prompt 7.4) ────────────────────────────
ALTER TABLE public.content_entries
  ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled')),
  ADD COLUMN publish_from timestamptz,
  ADD COLUMN publish_until timestamptz,
  ADD COLUMN updated_by_auth_user_id uuid;

ALTER TABLE public.content_entries
  ADD CONSTRAINT content_entries_window
    CHECK (publish_from IS NULL OR publish_until IS NULL OR publish_until > publish_from);

-- A scheduled entry must say when it starts.
ALTER TABLE public.content_entries
  ADD CONSTRAINT content_entries_schedule_needs_start
    CHECK (status <> 'scheduled' OR publish_from IS NOT NULL);

-- Bring the existing boolean into line with the new status vocabulary.
UPDATE public.content_entries SET status = 'published' WHERE is_published;

CREATE INDEX content_entries_visible_idx ON public.content_entries(section, entry_key, status);

-- Content changes are auditable: who changed what, and what it was before.
CREATE TABLE public.content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_entry_id uuid NOT NULL REFERENCES public.content_entries(id) ON DELETE CASCADE,
  previous_value jsonb,
  new_value jsonb NOT NULL,
  changed_by_auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_revisions_entry_idx ON public.content_revisions(content_entry_id, created_at DESC);

-- Records the previous value automatically, so an audit trail cannot be skipped
-- by a handler that forgets to write one.
CREATE OR REPLACE FUNCTION public.record_content_revision() RETURNS trigger AS $$
BEGIN
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.content_revisions(content_entry_id, previous_value, new_value, changed_by_auth_user_id)
    VALUES (OLD.id, OLD.value, NEW.value, NEW.updated_by_auth_user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_entries_audit
  AFTER UPDATE ON public.content_entries
  FOR EACH ROW EXECUTE FUNCTION public.record_content_revision();
