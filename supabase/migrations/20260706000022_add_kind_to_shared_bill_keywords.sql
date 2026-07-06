-- Migration 022: Add "kind" to shared_bill_keywords
--
-- Extends the keyword-matching import rule from a single behavior (split with
-- partner) to two: 'split' (existing) and 'reimbursed' (full refund — the user
-- pays the full amount but is fully reimbursed by a third party, e.g. employer).
-- Same matching mechanism, different downstream effect on the imported expense.

-- The existing unique (owner_id, keyword) constraint already ensures a keyword
-- means exactly one thing per user, regardless of kind.
alter table public.shared_bill_keywords
  add column kind text not null default 'split' check (kind in ('split', 'reimbursed'));
