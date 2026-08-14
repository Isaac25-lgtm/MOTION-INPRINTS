-- Final quote-integrity hardening.
--
-- Accepted quote line items are frozen by 0007. This replacement also freezes
-- every customer-visible term on the accepted quote header while still allowing
-- the bearer link to be revoked or rotated independently.

CREATE OR REPLACE FUNCTION public.freeze_accepted_quote() RETURNS trigger AS $$
BEGIN
  IF OLD.customer_accepted_at IS NOT NULL AND (
       NEW.quote_number IS DISTINCT FROM OLD.quote_number
    OR NEW.quote_request_id IS DISTINCT FROM OLD.quote_request_id
    OR NEW.status_code IS DISTINCT FROM OLD.status_code
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
    OR NEW.customer_accepted_at IS DISTINCT FROM OLD.customer_accepted_at
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.supersedes_quote_id IS DISTINCT FROM OLD.supersedes_quote_id
    OR NEW.superseded_at IS DISTINCT FROM OLD.superseded_at
    OR NEW.tax_rate_bp IS DISTINCT FROM OLD.tax_rate_bp
    OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
    OR NEW.production_assumptions IS DISTINCT FROM OLD.production_assumptions
    OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.declined_at IS DISTINCT FROM OLD.declined_at
    OR NEW.accepted_by_auth_user_id IS DISTINCT FROM OLD.accepted_by_auth_user_id
    OR NEW.accepted_total IS DISTINCT FROM OLD.accepted_total
  ) THEN
    RAISE EXCEPTION 'Quote % has been accepted and its agreed content cannot be changed.', OLD.quote_number
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only SHA-256 hex digests may be stored as guest credentials. Clear any legacy
-- value that is the right length but not actually a digest before adding the rule.
UPDATE public.quotes
SET access_token = NULL, access_token_expires_at = NULL, access_token_revoked_at = NULL
WHERE access_token IS NOT NULL AND access_token !~ '^[0-9a-f]{64}$';

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_access_token_is_sha256
  CHECK (access_token IS NULL OR access_token ~ '^[0-9a-f]{64}$');
