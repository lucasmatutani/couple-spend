-- Migration 018: add reimbursed flag to personal_expenses
-- reimbursed = true → expense was paid on behalf of a third party and will be
-- fully reimbursed; it does not count against the payer's or partner's spending.
alter table public.personal_expenses
  add column reimbursed boolean not null default false;
