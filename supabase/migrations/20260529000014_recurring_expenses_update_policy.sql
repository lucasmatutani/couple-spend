-- Migration 014: Add missing UPDATE policy on recurring_expenses.
-- Previously only SELECT, INSERT, DELETE were defined. UPDATE was absent,
-- causing deactivation and template edits to fail silently under RLS.

create policy recurring_expenses_update on public.recurring_expenses
  for update
  using (paid_by = auth.uid())
  with check (paid_by = auth.uid());
