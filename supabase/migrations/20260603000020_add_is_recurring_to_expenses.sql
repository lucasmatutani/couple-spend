-- Migration 020: Add is_recurring flag to expenses.
-- recurring_expense_id becomes null when a single entry is decoupled from its template,
-- but the entry is still conceptually a fixed/recurring expense for that month.
-- is_recurring preserves that identity after decoupling.

alter table public.expenses
  add column is_recurring boolean not null default false;

-- Backfill: entries still linked to a template are definitively recurring.
update public.expenses
  set is_recurring = true
  where recurring_expense_id is not null;
