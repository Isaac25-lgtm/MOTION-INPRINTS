-- Closes two defects in the proof-approval guarantees introduced by 0010.
--
-- Verified reproducible on PostgreSQL 18 before this migration:
--
--   1. An answered proof could be DELETED. The freeze trigger was BEFORE UPDATE
--      only, so the evidentiary record could be removed entirely rather than
--      altered — which defeats the purpose of keeping it.
--
--   2. A proof belonging to Order B could be written into Order A's
--      approved_proof_id, and Order A would then pass the production gate. The
--      gate checked only that the column was non-null.
--
-- Both are fixed in the database rather than in route handlers, so no future
-- endpoint, script or bulk action can reintroduce them.

-- ── 1. An answered proof cannot be deleted ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_answered_proof_delete() RETURNS trigger AS $$
BEGIN
  IF OLD.customer_response_at IS NOT NULL THEN
    RAISE EXCEPTION 'Proof version % has been answered by the customer and cannot be deleted.', OLD.version
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER design_proofs_protect_delete
  BEFORE DELETE ON public.design_proofs
  FOR EACH ROW EXECUTE FUNCTION public.protect_answered_proof_delete();

-- ── 2. Every evidentiary field is immutable once answered ──────────────────
-- The previous version protected a subset. The record is only evidence if the
-- whole of it is fixed: which order, which item, which file, which version, what
-- Motion said, who uploaded it, when, and what the customer replied.
--
-- The single permitted change is supersession, and even then only the two
-- supersession columns may move.
CREATE OR REPLACE FUNCTION public.freeze_answered_proof() RETURNS trigger AS $$
BEGIN
  IF OLD.customer_response_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.order_item_id IS DISTINCT FROM OLD.order_item_id
     OR NEW.media_id IS DISTINCT FROM OLD.media_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.motion_notes IS DISTINCT FROM OLD.motion_notes
     OR NEW.uploaded_by_auth_user_id IS DISTINCT FROM OLD.uploaded_by_auth_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.customer_response_at IS DISTINCT FROM OLD.customer_response_at
     OR NEW.customer_response_by_auth_user_id IS DISTINCT FROM OLD.customer_response_by_auth_user_id
     OR NEW.customer_comment IS DISTINCT FROM OLD.customer_comment THEN
    RAISE EXCEPTION 'Proof version % has been answered and its record cannot be changed.', OLD.version
      USING ERRCODE = 'check_violation';
  END IF;

  -- Status may only move to 'superseded', and only alongside a supersession
  -- timestamp. It can never return to an unanswered state.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status <> 'superseded' OR OLD.superseded_at IS NOT NULL THEN
      RAISE EXCEPTION 'Proof version % has been answered; only supersession is permitted.', OLD.version
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN
    RAISE EXCEPTION 'Proof version % was already superseded.', OLD.version
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. approved_proof_id must be a real approval for THIS order ────────────
-- Validated whenever the column is set, so the invalid state cannot exist at
-- all — not merely be caught later at the production gate.
CREATE OR REPLACE FUNCTION public.validate_approved_proof() RETURNS trigger AS $$
DECLARE
  proof RECORD;
BEGIN
  IF NEW.approved_proof_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT order_id, status, customer_response_at, version
    INTO proof
    FROM public.design_proofs
   WHERE id = NEW.approved_proof_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved proof % does not exist.', NEW.approved_proof_id USING ERRCODE = 'check_violation';
  END IF;

  -- A proof from another order is never evidence for this one.
  IF proof.order_id <> NEW.id THEN
    RAISE EXCEPTION 'Proof % belongs to a different order and cannot approve order %.', NEW.approved_proof_id, NEW.order_number
      USING ERRCODE = 'check_violation';
  END IF;

  IF proof.status <> 'approved' OR proof.customer_response_at IS NULL THEN
    RAISE EXCEPTION 'Proof version % has not been approved by the customer.', proof.version
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_validate_approved_proof
  BEFORE INSERT OR UPDATE OF approved_proof_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_approved_proof();

-- ── 4. The production gate re-checks, rather than trusting the column ──────
-- Defence in depth: even if a row reached a bad state by some path that skips
-- the trigger above, production entry independently verifies the approval.
CREATE OR REPLACE FUNCTION public.guard_production_entry() RETURNS trigger AS $$
DECLARE
  valid boolean;
BEGIN
  IF NEW.status_code IN ('in_production', 'ready', 'dispatched', 'completed')
     AND OLD.status_code IS DISTINCT FROM NEW.status_code
     AND NEW.requires_proof_approval THEN

    SELECT EXISTS (
      SELECT 1 FROM public.design_proofs p
       WHERE p.id = NEW.approved_proof_id
         AND p.order_id = NEW.id
         AND p.status = 'approved'
         AND p.customer_response_at IS NOT NULL
    ) INTO valid;

    IF NOT valid THEN
      RAISE EXCEPTION 'Order % requires a customer-approved proof of its own before production.', OLD.order_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
