-- Catalogue detail, explicit recommendations, compatibility rules and upload lifecycle.

BEGIN;

CREATE TABLE public.product_specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(trim(label)) > 0),
  value text NOT NULL CHECK (length(trim(value)) > 0),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  UNIQUE(product_id, label)
);
CREATE INDEX product_specifications_product_idx
  ON public.product_specifications(product_id, sort_order, label);

-- Recommendations are editorial decisions. They are never inferred from browsing
-- behaviour or invented by the frontend.
CREATE TABLE public.related_products (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  related_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY (product_id, related_product_id),
  CHECK (product_id <> related_product_id)
);
CREATE INDEX related_products_order_idx
  ON public.related_products(product_id, sort_order);

-- If both maps match a submitted selection, the combination is invalid. This
-- expresses rules such as "embroidery is unavailable on this garment material"
-- without product-specific application code.
CREATE TABLE public.product_option_compatibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  when_selection jsonb NOT NULL DEFAULT '{}'::jsonb,
  disallow_selection jsonb NOT NULL,
  message text NOT NULL CHECK (length(trim(message)) > 0),
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CHECK (jsonb_typeof(when_selection) = 'object'),
  CHECK (jsonb_typeof(disallow_selection) = 'object'),
  CHECK (disallow_selection <> '{}'::jsonb)
);
CREATE INDEX product_compatibility_rules_idx
  ON public.product_option_compatibility_rules(product_id, is_active, priority DESC);

-- A signed upload URL is only an intent. Mark an asset available after the file
-- transfer completes, so a failed upload is not presented as customer artwork.
ALTER TABLE public.media_assets
  ADD COLUMN upload_status text NOT NULL DEFAULT 'available'
    CHECK (upload_status IN ('pending', 'available', 'failed'));

COMMIT;
