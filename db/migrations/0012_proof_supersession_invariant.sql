-- Closes a half-supersession gap left by 0011.
--
-- Reproducible on PostgreSQL 18 before this migration, on an answered proof:
--
--   UPDATE design_proofs SET superseded_at = now()      -- status stayed 'approved'
--   UPDATE design_proofs SET status = 'superseded'      -- superseded_at stayed NULL
--
-- Both were permitted. 0011 examined `status` and `superseded_at` independently,
-- so changing one without the other passed every check.
--
-- Either half-state is corrupting rather than merely untidy, because two
-- different things read these columns and would disagree:
--
--   * the partial unique index `design_proofs_one_active` filters on
--     `superseded_at IS NULL AND status = 'awaiting_response'`;
--   * `validate_approved_proof` and `guard_production_entry` accept a proof whose
--     status is 'approved'.
--
-- So a proof with `superseded_at` set but status still 'approved' remains valid
-- evidence for production despite having been replaced — which is the exact
-- outcome the supersession rule exists to prevent.

-- ── 1. The invariant, at table level ───────────────────────────────────────
-- A CHECK holds for every row at all times, answered or not, and for any writer
-- — including a future migration or a manual fix applied in a console. That is
-- strictly stronger than enforcing it only on UPDATE of an answered proof.
--
-- No existing row violates this (verified: 0 rows), so no data repair is needed.
-- The UPDATE below is a safety net for any environment where one slipped in
-- before the constraint existed.
UPDATE public.design_proofs
   SET superseded_at = COALESCE(superseded_at, now())
 WHERE status = 'superseded' AND superseded_at IS NULL;

UPDATE public.design_proofs
   SET status = 'superseded'
 WHERE status <> 'superseded' AND superseded_at IS NOT NULL;

ALTER TABLE public.design_proofs
  ADD CONSTRAINT design_proofs_supersession_consistent
  CHECK ((status = 'superseded') = (superseded_at IS NOT NULL));

-- ── 2. The trigger states the rule in words ────────────────────────────────
-- The constraint above already makes a half-state impossible. This gives the
-- specific reason rather than a bare constraint name, and keeps the supersession
-- rule for answered proofs in one readable place.
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

  -- Already superseded: nothing further may move.
  IF OLD.superseded_at IS NOT NULL THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN
      RAISE EXCEPTION 'Proof version % was already superseded.', OLD.version
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Not yet superseded: the only permitted change is supersession, and both
  -- columns must move together in the same statement.
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN
    IF NEW.status <> 'superseded' OR NEW.superseded_at IS NULL THEN
      RAISE EXCEPTION
        'Proof version % has been answered; it may only be superseded, and that requires setting both status and superseded_at together.',
        OLD.version
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
