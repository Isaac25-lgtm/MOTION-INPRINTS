-- Pricing components (Prompt 5.3).
--
-- The original pricing_rules table carried a single flat `price`, which can state
-- "500 cards = 180,000" but not "double-sided +15,000" or "embroidery +3,500 each".
-- Those are the two shapes every worked example in the brief needs, so a rule now
-- declares what KIND of component it is and the engine composes them.
--
-- Amounts stay numeric(14,2) for consistency with the rest of the schema; the
-- application treats them as whole shillings (see server/money.js).

ALTER TABLE public.pricing_rules
  ADD COLUMN component_type text NOT NULL DEFAULT 'base'
    CHECK (component_type IN ('base', 'quantity_tier', 'surcharge_fixed', 'surcharge_per_unit')),
  ADD COLUMN label text,
  ADD COLUMN min_quantity integer CHECK (min_quantity IS NULL OR min_quantity > 0),
  ADD COLUMN max_quantity integer CHECK (max_quantity IS NULL OR max_quantity > 0),
  -- Option values this component depends on, as {option_code: value}. An empty
  -- object means the component always applies.
  ADD COLUMN applies_when jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- A configuration that is priced by hand rather than by rule.
  ADD COLUMN requires_quote boolean NOT NULL DEFAULT false;

-- A tier must describe a coherent range.
ALTER TABLE public.pricing_rules
  ADD CONSTRAINT pricing_rules_quantity_range
    CHECK (min_quantity IS NULL OR max_quantity IS NULL OR max_quantity >= min_quantity);

-- Every component except a quote-flagged one needs an amount to contribute.
ALTER TABLE public.pricing_rules
  ADD CONSTRAINT pricing_rules_price_present
    CHECK (requires_quote OR price IS NOT NULL);

CREATE INDEX pricing_rules_component_idx
  ON public.pricing_rules(product_id, component_type, is_active);

-- Quantity bounds for the product as a whole, independent of any tier.
-- `is_featured` already exists from migration 0001 and is deliberately not repeated here.
ALTER TABLE public.products
  ADD COLUMN min_quantity integer NOT NULL DEFAULT 1 CHECK (min_quantity > 0),
  ADD COLUMN max_quantity integer CHECK (max_quantity IS NULL OR max_quantity > 0),
  -- Artwork expectations drive the order workflow (Prompt 8.2).
  ADD COLUMN artwork_requirement text NOT NULL DEFAULT 'optional'
    CHECK (artwork_requirement IN ('none', 'optional', 'required', 'design_available'));

ALTER TABLE public.products
  ADD CONSTRAINT products_quantity_range
    CHECK (max_quantity IS NULL OR max_quantity >= min_quantity);

CREATE INDEX products_featured_idx ON public.products(is_featured, status) WHERE is_featured;

-- Option values can carry their own default surcharge, so simple products do not
-- need a pricing rule per value.
ALTER TABLE public.product_option_values
  ADD COLUMN surcharge numeric(14,2) CHECK (surcharge IS NULL OR surcharge >= 0),
  ADD COLUMN surcharge_kind text NOT NULL DEFAULT 'fixed'
    CHECK (surcharge_kind IN ('fixed', 'per_unit')),
  ADD COLUMN requires_quote boolean NOT NULL DEFAULT false,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Option assignments describe how the option is presented on the product page.
ALTER TABLE public.product_option_assignments
  ADD COLUMN group_label text,
  ADD COLUMN help_text text,
  ADD COLUMN default_value text;
