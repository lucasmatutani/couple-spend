-- Migration 019: distinguish "split cost among N people" from "split with household partner"
-- split_with_partner = true → creates a household expense charging the partner their share.
-- split_parts > 1 alone → divides personal cost only, no household debt created.
alter table public.personal_expenses
  add column split_with_partner boolean not null default false;

-- Backfill: existing rows with split_parts > 1 were intended as partner splits.
update public.personal_expenses
  set split_with_partner = true
  where split_parts > 1 and reimbursed = false;
