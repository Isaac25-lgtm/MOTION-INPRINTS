-- Completes the immutability of an accepted quote (Prompt 6.2).
--
-- Migration 0004 froze the quote header, but its line items stayed mutable, so
-- specifications, quantities and line prices could still be edited or deleted
-- after a customer had accepted. The header total would then no longer describe
-- what was actually agreed.

CREATE OR REPLACE FUNCTION public.freeze_accepted_quote_items() RETURNS trigger AS $$
DECLARE
  accepted timestamptz;
  target uuid;
BEGIN
  target := COALESCE(NEW.quote_id, OLD.quote_id);
  SELECT customer_accepted_at INTO accepted FROM public.quotes WHERE id = target;

  IF accepted IS NOT NULL THEN
    RAISE EXCEPTION 'Quote % has been accepted and its line items cannot be changed.', target
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_items_freeze_accepted
  BEFORE INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.freeze_accepted_quote_items();

-- Guest access tokens are bearer credentials and are now stored as SHA-256
-- hashes rather than plaintext (see server/quotes.js). Any token issued before
-- this migration is plaintext and therefore unusable — clear them so a stale
-- value cannot be presented as a hash.
UPDATE public.quotes SET access_token = NULL WHERE access_token IS NOT NULL AND length(access_token) <> 64;

-- Tokens expire independently of the quote's own validity, so a forwarded link
-- stops working even if the quote is still open.
ALTER TABLE public.quotes
  ADD COLUMN access_token_expires_at timestamptz,
  ADD COLUMN access_token_revoked_at timestamptz;
