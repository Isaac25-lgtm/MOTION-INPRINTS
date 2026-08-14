-- Design proofs, order tracking and the admin audit trail (Prompts 9.2, 9.3, 10.7).

-- ── Design proofs ───────────────────────────────────────────────────────────
-- The point of this table is evidentiary: it must always be possible to say
-- exactly which version a customer approved, and when. Versions are therefore
-- never overwritten — a revision is a new row and the previous one is retained
-- as superseded.
CREATE TABLE public.design_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  version integer NOT NULL CHECK (version > 0),
  media_id uuid REFERENCES public.media_assets(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'awaiting_response'
    CHECK (status IN ('awaiting_response', 'approved', 'changes_requested', 'superseded')),
  motion_notes text,
  uploaded_by_auth_user_id uuid,
  -- Customer response, recorded against this exact version.
  customer_response_at timestamptz,
  customer_response_by_auth_user_id uuid,
  customer_comment text,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, version)
);

CREATE INDEX design_proofs_order_idx ON public.design_proofs(order_id, version DESC);

-- Only one proof per order may be awaiting a decision. A revision must supersede
-- the previous version rather than sit alongside it.
CREATE UNIQUE INDEX design_proofs_one_active
  ON public.design_proofs(order_id)
  WHERE superseded_at IS NULL AND status = 'awaiting_response';

-- An answered proof is evidence. Once the customer has responded, neither the
-- file nor the response may be altered — only supersession is permitted.
CREATE OR REPLACE FUNCTION public.freeze_answered_proof() RETURNS trigger AS $$
BEGIN
  IF OLD.customer_response_at IS NOT NULL THEN
    IF NEW.media_id IS DISTINCT FROM OLD.media_id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.customer_response_at IS DISTINCT FROM OLD.customer_response_at
       OR NEW.customer_response_by_auth_user_id IS DISTINCT FROM OLD.customer_response_by_auth_user_id
       OR NEW.customer_comment IS DISTINCT FROM OLD.customer_comment
       OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'superseded') THEN
      RAISE EXCEPTION 'Proof version % has already been answered and cannot be changed.', OLD.version
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER design_proofs_freeze_answered
  BEFORE UPDATE ON public.design_proofs
  FOR EACH ROW EXECUTE FUNCTION public.freeze_answered_proof();

-- Whether a job needs approval before production, and which proof authorised it.
ALTER TABLE public.orders
  ADD COLUMN requires_proof_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN approved_proof_id uuid REFERENCES public.design_proofs(id) ON DELETE SET NULL,
  -- Guest tracking must not be reachable by guessing an order number, so a
  -- separate high-entropy token is stored as a SHA-256 hash (Prompt 9.2).
  ADD COLUMN tracking_token text,
  ADD COLUMN internal_notes text;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_tracking_token_hashed
  CHECK (tracking_token IS NULL OR tracking_token ~ '^[0-9a-f]{64}$');

-- A job that requires approval cannot enter production without one. Enforced in
-- the database so no admin route, script or bulk action can bypass it.
CREATE OR REPLACE FUNCTION public.guard_production_entry() RETURNS trigger AS $$
BEGIN
  IF NEW.status_code IN ('in_production', 'ready', 'dispatched', 'completed')
     AND OLD.status_code IS DISTINCT FROM NEW.status_code
     AND NEW.requires_proof_approval
     AND NEW.approved_proof_id IS NULL THEN
    RAISE EXCEPTION 'Order % requires an approved proof before production.', OLD.order_number
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_guard_production
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_production_entry();

-- ── Admin audit trail (Prompt 10.7) ────────────────────────────────────────
-- Records who did what to which record. Values are summaries, never secrets.
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_auth_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_entity_idx ON public.admin_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX admin_audit_actor_idx ON public.admin_audit_log(actor_auth_user_id, created_at DESC);

-- ── Reporting support ───────────────────────────────────────────────────────
-- Reports must exclude cancelled orders and count only settled money, so the
-- columns those queries filter on are indexed.
CREATE INDEX orders_created_status_idx ON public.orders(created_at DESC, status_code);
CREATE INDEX payments_status_created_idx ON public.payments(status, created_at DESC);
CREATE INDEX order_items_product_idx ON public.order_items(product_id);
