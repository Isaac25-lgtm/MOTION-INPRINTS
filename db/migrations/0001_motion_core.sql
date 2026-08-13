BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  full_name text,
  phone text,
  company_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.user_profiles.auth_user_id IS 'Identity UUID issued by Neon Auth; credentials remain in Neon Auth.';

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  name text NOT NULL, slug text NOT NULL UNIQUE, description text, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  name text NOT NULL, slug text NOT NULL UNIQUE, short_description text, description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  pricing_type text NOT NULL CHECK (pricing_type IN ('fixed','configurable','quote_only')),
  starting_price numeric(14,2) CHECK (starting_price IS NULL OR starting_price >= 0), currency char(3) NOT NULL DEFAULT 'UGX',
  sku text UNIQUE, is_featured boolean NOT NULL DEFAULT false, is_configurable boolean NOT NULL DEFAULT false,
  quote_required boolean NOT NULL DEFAULT false, production_lead_time text, seo_title text, seo_description text,
  published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((pricing_type = 'quote_only') = quote_required),
  CHECK (pricing_type <> 'fixed' OR starting_price IS NOT NULL)
);
CREATE INDEX products_catalogue_idx ON public.products(category_id, status, published_at DESC);

CREATE TABLE public.product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL, input_type text NOT NULL DEFAULT 'select' CHECK (input_type IN ('select','number','boolean','text')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), option_id uuid NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  value text NOT NULL, label text NOT NULL, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  UNIQUE(option_id, value)
);
CREATE TABLE public.product_option_assignments (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, option_id uuid NOT NULL REFERENCES public.product_options(id) ON DELETE RESTRICT,
  is_required boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0), PRIMARY KEY(product_id, option_id)
);
CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  rule_type text NOT NULL DEFAULT 'matrix' CHECK (rule_type IN ('matrix','formula','manual')),
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb, price numeric(14,2) CHECK (price IS NULL OR price >= 0),
  currency char(3) NOT NULL DEFAULT 'UGX', priority integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pricing_rules_product_idx ON public.pricing_rules(product_id, is_active, priority DESC);

CREATE TABLE public.order_statuses (
  code text PRIMARY KEY, label text NOT NULL, sort_order integer NOT NULL UNIQUE CHECK (sort_order >= 0), is_terminal boolean NOT NULL DEFAULT false
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL, quote_id uuid UNIQUE,
  contact_name text NOT NULL, contact_email text NOT NULL, contact_phone text, status_code text NOT NULL REFERENCES public.order_statuses(code),
  subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0), discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0), currency char(3) NOT NULL DEFAULT 'UGX',
  notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_customer_idx ON public.orders(customer_id, created_at DESC);
CREATE INDEX orders_status_idx ON public.orders(status_code, created_at DESC);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL, title text NOT NULL, sku text, quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,2) CHECK (unit_price IS NULL OR unit_price >= 0), line_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status_code text NOT NULL REFERENCES public.order_statuses(code), changed_by_auth_user_id uuid, note text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_history_order_idx ON public.order_status_history(order_id, created_at DESC);

CREATE TABLE public.quote_statuses (code text PRIMARY KEY, label text NOT NULL, sort_order integer NOT NULL UNIQUE, is_terminal boolean NOT NULL DEFAULT false);
CREATE TABLE public.quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_number text NOT NULL UNIQUE, customer_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  contact_name text NOT NULL, contact_email text NOT NULL, contact_phone text, project_brief text NOT NULL, status_code text NOT NULL REFERENCES public.quote_statuses(code),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quote_requests_customer_idx ON public.quote_requests(customer_id, created_at DESC);
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_number text NOT NULL UNIQUE, quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE RESTRICT,
  status_code text NOT NULL REFERENCES public.quote_statuses(code), subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0), total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  currency char(3) NOT NULL DEFAULT 'UGX', valid_until date, customer_accepted_at timestamptz, created_by_auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL, title text NOT NULL, quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0), line_total numeric(14,2) NOT NULL CHECK (line_total >= 0), configuration jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.orders ADD CONSTRAINT orders_quote_fk FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;
CREATE TABLE public.quote_status_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE, status_code text NOT NULL REFERENCES public.quote_statuses(code), changed_by_auth_user_id uuid, note text, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  title text NOT NULL, slug text NOT NULL UNIQUE, client_name text, location text, description text, completed_on date,
  is_featured boolean NOT NULL DEFAULT false, is_published boolean NOT NULL DEFAULT false, published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_public_idx ON public.projects(is_published, is_featured, completed_on DESC);

CREATE TABLE public.content_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), section text NOT NULL, entry_key text NOT NULL, value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(section, entry_key)
);

CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_key text NOT NULL UNIQUE, original_filename text NOT NULL, mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0), visibility text NOT NULL CHECK (visibility IN ('public','private')), purpose text NOT NULL,
  uploaded_by_auth_user_id uuid, width integer CHECK (width IS NULL OR width > 0), height integer CHECK (height IS NULL OR height > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_media (product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0), PRIMARY KEY(product_id, media_id));
CREATE TABLE public.project_media (project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE, media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE, sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0), PRIMARY KEY(project_id, media_id));
CREATE TABLE public.order_item_media (order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE, media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE, media_role text NOT NULL CHECK (media_role IN ('artwork','proof','other')), PRIMARY KEY(order_item_id, media_id));
CREATE TABLE public.quote_request_media (quote_request_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE, media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE, PRIMARY KEY(quote_request_id, media_id));

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0), currency char(3) NOT NULL DEFAULT 'UGX', provider text NOT NULL,
  provider_reference text, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','authorized','paid','failed','refunded','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider, provider_reference)
);

CREATE TRIGGER user_profiles_updated BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_options_updated BEFORE UPDATE ON public.product_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pricing_rules_updated BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER quote_requests_updated BEFORE UPDATE ON public.quote_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER quotes_updated BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER content_entries_updated BEFORE UPDATE ON public.content_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
