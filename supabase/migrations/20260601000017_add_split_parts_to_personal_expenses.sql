-- Migration 017: add split_parts to personal_expenses
-- Tracks how many ways a credit-card expense is split.
-- split_parts = 1 → fully personal; split_parts = N → user's share is 1/N.
alter table public.personal_expenses
  add column split_parts integer not null default 1
  constraint personal_expenses_split_parts_check check (split_parts >= 1);
