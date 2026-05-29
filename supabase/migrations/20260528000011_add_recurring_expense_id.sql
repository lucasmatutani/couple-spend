-- Migration 011: Link generated expense entries back to their recurring template.
-- on delete set null keeps historical entries when a template is deactivated.

alter table public.expenses
  add column recurring_expense_id uuid
    references public.recurring_expenses(id) on delete set null;

alter table public.personal_expenses
  add column recurring_personal_expense_id uuid
    references public.recurring_personal_expenses(id) on delete set null;
