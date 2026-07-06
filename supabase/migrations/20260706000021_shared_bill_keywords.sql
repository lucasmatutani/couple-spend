-- Migration 021: Shared bill keywords
--
-- Lets a user register merchant/description keywords (e.g. "Netflix", "Condomínio")
-- that always show up on their credit-card invoice as a recurring bill already
-- split with their partner. Fed into the PDF extraction prompt (import-pdf) so
-- matching transactions are imported pre-flagged for the partner split instead
-- of requiring manual editing every month.

create table public.shared_bill_keywords (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null references public.users (id),
  keyword    text        not null check (char_length(keyword) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (owner_id, keyword)
);

alter table public.shared_bill_keywords enable row level security;

create policy shared_bill_keywords_owner on public.shared_bill_keywords
  for all
  using   (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
