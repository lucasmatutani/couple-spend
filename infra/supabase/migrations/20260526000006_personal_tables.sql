-- Migration 006: Personal tables (user-scoped, never shared)
--
-- These tables are invisible to household members by design (ADR-006, CLAUDE.md §4.2).
-- RLS policy: owner_id = auth.uid() for all operations.

-- ── Personal expenses ─────────────────────────────────────────────────────────

create table public.personal_expenses (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null references public.users (id),
  category_id  uuid        not null references public.categories (id),
  occurred_at  date        not null,
  amount_cents bigint      not null check (amount_cents > 0),
  description  text,
  source_id    text        not null default 'manual',
  external_id  text        not null default gen_random_uuid()::text,
  imported_at  timestamptz not null default now(),
  unique (owner_id, source_id, external_id)
);

alter table public.personal_expenses enable row level security;

create policy personal_expenses_owner on public.personal_expenses
  for all
  using   (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── Incomes ───────────────────────────────────────────────────────────────────
-- Income is always individual (never shared). Refunds are PersonalExpense,
-- not negative Income (SPEC §5.3).

create table public.incomes (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null references public.users (id),
  occurred_at  date        not null,
  amount_cents bigint      not null check (amount_cents > 0),
  source       text        not null,
  recurring    boolean     not null default false,
  created_at   timestamptz not null default now()
);

alter table public.incomes enable row level security;

create policy incomes_owner on public.incomes
  for all
  using   (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── Investments ───────────────────────────────────────────────────────────────
-- Investment is NOT an expense: it never enters total_spent calculations.
-- Modelled separately so UI can distinguish committed money from spending.

create table public.investments (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null references public.users (id),
  occurred_at  date        not null,
  amount_cents bigint      not null check (amount_cents > 0),
  asset_class  text        not null,
  description  text,
  created_at   timestamptz not null default now()
);

alter table public.investments enable row level security;

create policy investments_owner on public.investments
  for all
  using   (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
