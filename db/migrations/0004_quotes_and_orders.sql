-- Quote lifecycle, versioning and order infrastructure (Prompts 6.1-6.4, 8.1-8.4).

-- ── Quote requests ──────────────────────────────────────────────────────────
-- Intake varies by project type, and the answers are type-specific, so they are
-- stored as a structured document rather than as columns that are null for every
-- project type but one.
ALTER TABLE public.quote_requests
  ADD COLUMN project_type text,
  ADD COLUMN answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN preferred_contact text CHECK (preferred_contact IS NULL OR preferred_contact IN ('phone', 'whatsapp', 'email')),
  ADD COLUMN desired_timeline text,
  ADD COLUMN source text NOT NULL DEFAULT 'website';

-- ── Quote versioning ────────────────────────────────────────────────────────
-- A quote is never edited after it is sent. A revision is a new row that
-- supersedes the previous one, so an accepted figure can always be recovered.
ALTER TABLE public.quotes
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN supersedes_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN superseded_at timestamptz,
  -- Tax is configured per quote, never assumed. A null rate means no tax applies.
  ADD COLUMN tax_rate_bp integer CHECK (tax_rate_bp IS NULL OR (tax_rate_bp >= 0 AND tax_rate_bp <= 10000)),
  ADD COLUMN tax_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  ADD COLUMN production_assumptions text,
  ADD COLUMN payment_terms text,
  ADD COLUMN notes text,
  ADD COLUMN sent_at timestamptz,
  ADD COLUMN declined_at timestamptz,
  -- Bearer token for the protected guest link (Prompt 6.3). Null until the quote
  -- is sent; rotated if it is ever re-sent.
  ADD COLUMN access_token text UNIQUE,
  ADD COLUMN accepted_by_auth_user_id uuid,
  ADD COLUMN accepted_total numeric(14,2) CHECK (accepted_total IS NULL OR accepted_total >= 0);

-- At most one live quote per request. Superseded and declined rows stay for history.
CREATE UNIQUE INDEX quotes_one_active_per_request
  ON public.quotes(quote_request_id)
  WHERE superseded_at IS NULL AND status_code <> 'declined';

CREATE INDEX quotes_request_version_idx ON public.quotes(quote_request_id, version DESC);

-- An accepted quote is immutable. Postgres enforces it, so no handler can forget.
CREATE OR REPLACE FUNCTION public.freeze_accepted_quote() RETURNS trigger AS $$
BEGIN
  IF OLD.customer_accepted_at IS NOT NULL THEN
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
       OR NEW.accepted_total IS DISTINCT FROM OLD.accepted_total
       OR NEW.version IS DISTINCT FROM OLD.version THEN
      RAISE EXCEPTION 'Quote % has been accepted and its figures cannot be changed.', OLD.quote_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_freeze_accepted
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.freeze_accepted_quote();

-- Customer-initiated change requests. Kept separate from status history so a
-- customer's words are never confused with a staff status note.
CREATE TABLE public.quote_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  message text NOT NULL,
  requested_by_auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quote_change_requests_quote_idx ON public.quote_change_requests(quote_id, created_at DESC);

-- ── Orders: fulfilment and artwork ─────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN fulfilment_method text NOT NULL DEFAULT 'collection'
    CHECK (fulfilment_method IN ('collection', 'delivery')),
  ADD COLUMN delivery_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (delivery_amount >= 0),
  ADD COLUMN delivery_address text,
  ADD COLUMN delivery_notes text,
  ADD COLUMN company_name text,
  ADD COLUMN tax_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  ADD COLUMN placed_by_auth_user_id uuid;

-- A delivery order must say where it is going.
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_needs_address
    CHECK (fulfilment_method <> 'delivery' OR (delivery_address IS NOT NULL AND length(trim(delivery_address)) > 0));

ALTER TABLE public.order_items
  ADD COLUMN design_service_required boolean NOT NULL DEFAULT false,
  ADD COLUMN artwork_status text NOT NULL DEFAULT 'not_required'
    CHECK (artwork_status IN ('not_required', 'awaiting_upload', 'received', 'in_design', 'approved')),
  -- The price breakdown as calculated at the moment of purchase. Kept so a later
  -- price change can never alter what a customer was charged.
  ADD COLUMN price_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── Idempotency ─────────────────────────────────────────────────────────────
-- One row per operation key. The stored response is replayed on a repeat, so a
-- double-submitted checkout returns the original order instead of a second one.
CREATE TABLE public.idempotency_keys (
  key text PRIMARY KEY,
  scope text NOT NULL,
  request_fingerprint text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idempotency_keys_created_idx ON public.idempotency_keys(created_at);

-- ── Payments ────────────────────────────────────────────────────────────────
-- The original CHECK allowed pending/authorized/paid/failed/refunded/cancelled,
-- which cannot express the states Prompt 8.4 requires. Replaced rather than
-- extended so there is exactly one vocabulary.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
UPDATE public.payments SET status = 'successful' WHERE status = 'paid';
UPDATE public.payments SET status = 'processing' WHERE status = 'authorized';
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'cancelled', 'expired', 'refunded'));

ALTER TABLE public.payments
  ADD COLUMN provider_status text,
  ADD COLUMN failure_reason text,
  ADD COLUMN verified_at timestamptz,
  -- Diagnostic detail only. Provider secrets and card data must never be written here.
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX payments_order_idx ON public.payments(order_id, created_at DESC);

-- Webhook deliveries, recorded before processing so a replay is detectable even
-- if processing fails part-way.
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);
