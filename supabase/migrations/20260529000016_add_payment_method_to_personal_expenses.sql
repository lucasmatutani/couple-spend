-- Migration 016: Add payment_method to personal_expenses
-- Nullable so existing rows remain valid; new entries can be tagged.
alter table public.personal_expenses
  add column payment_method text check (
    payment_method in ('credit_card', 'debit', 'pix', 'cash', 'other')
  );
