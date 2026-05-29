-- Migration 013: Optional installment count on recurring expense templates.
-- null  → repeat until end of current year (default behavior)
-- n > 0 → generate exactly n monthly entries

alter table public.recurring_expenses
  add column installment_count int check (installment_count > 0);

alter table public.recurring_personal_expenses
  add column installment_count int check (installment_count > 0);
