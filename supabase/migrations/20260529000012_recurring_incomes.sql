-- Migration 012: Recurring income templates, mirroring the recurring_expenses pattern.

create table public.recurring_incomes (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null references public.users(id) on delete cascade,
  source       text        not null,
  amount_cents bigint      not null check (amount_cents > 0),
  active       boolean     not null default true,
  created_at   timestamptz not null default now()
);

alter table public.recurring_incomes enable row level security;

create policy recurring_incomes_all on public.recurring_incomes
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Link generated income entries back to their template.
alter table public.incomes
  add column recurring_income_id uuid
    references public.recurring_incomes(id) on delete set null;
