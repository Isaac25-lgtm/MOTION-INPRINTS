-- Reconciles the quote status lookup with the lifecycle Prompt 6.2 specifies.
--
-- Migration 0002 seeded: submitted, reviewing, quoted, accepted, declined, expired, cancelled.
-- The brief's workflow is:
--   Request Submitted -> Under Review -> Quote Prepared -> Sent to Customer
--                     -> Accepted | Changes Requested | Declined | Expired
--
-- So `sent` and `changes_requested` were missing entirely, and two codes were
-- named differently from the workflow they implement. Because status_code is a
-- foreign key, the application could not have written those states at all — every
-- attempt would have raised quotes_status_code_fkey. Found by running the quote
-- lifecycle against a real database for the first time.

INSERT INTO public.quote_statuses (code, label, sort_order, is_terminal) VALUES
  ('under_review',      'Under review',      20, false),
  ('prepared',          'Quote prepared',    30, false),
  ('sent',              'Sent to customer',  40, false),
  ('changes_requested', 'Changes requested', 50, false)
ON CONFLICT (code) DO NOTHING;

-- Re-point any existing rows from the old codes onto the workflow's names.
UPDATE public.quotes SET status_code = 'under_review' WHERE status_code = 'reviewing';
UPDATE public.quotes SET status_code = 'prepared' WHERE status_code = 'quoted';
UPDATE public.quote_status_history SET status_code = 'under_review' WHERE status_code = 'reviewing';
UPDATE public.quote_status_history SET status_code = 'prepared' WHERE status_code = 'quoted';

-- Retire the superseded codes now that nothing references them. Guarded so the
-- migration is safe even if a row was added between the update and this delete.
DELETE FROM public.quote_statuses
 WHERE code IN ('reviewing', 'quoted')
   AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.status_code = public.quote_statuses.code)
   AND NOT EXISTS (SELECT 1 FROM public.quote_status_history h WHERE h.status_code = public.quote_statuses.code);

-- Keep the ordering coherent for anything that lists statuses for display.
UPDATE public.quote_statuses SET sort_order = 10 WHERE code = 'submitted';
UPDATE public.quote_statuses SET sort_order = 60, is_terminal = true WHERE code = 'accepted';
UPDATE public.quote_statuses SET sort_order = 70, is_terminal = true WHERE code = 'declined';
UPDATE public.quote_statuses SET sort_order = 80, is_terminal = true WHERE code = 'expired';
UPDATE public.quote_statuses SET sort_order = 90, is_terminal = true WHERE code = 'cancelled';
