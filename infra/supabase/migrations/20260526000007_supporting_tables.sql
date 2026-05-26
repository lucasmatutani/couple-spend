-- Migration 007: Categorization memory, budget goals, connected accounts
--
-- category_memory is household-scoped but owner-only (CLAUDE.md §4.2):
--   household_id enforces it belongs to the right tenant;
--   owner_id = auth.uid() enforces personal privacy within the household.
-- Open decision: may relax to household-shared memory later (SPEC §13).

-- ── Category memory ───────────────────────────────────────────────────────────

create table public.category_memory (
  id                  uuid          primary key default gen_random_uuid(),
  household_id        uuid          not null references public.households (id),
  owner_id            uuid          not null references public.users (id),
  description_pattern text          not null,
  category_id         uuid          not null references public.categories (id),
  confidence          numeric(3, 2) not null default 1.0,
  unique (household_id, owner_id, description_pattern)
);

alter table public.category_memory enable row level security;

create policy category_memory_owner on public.category_memory
  for all
  using   (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── Budget goals ──────────────────────────────────────────────────────────────
-- applies_to_month = NULL means the goal recurs every month.

create table public.goals (
  id               uuid      primary key default gen_random_uuid(),
  owner_id         uuid      not null references public.users (id),
  goal_type        goal_type not null,
  target_percent   int       not null check (target_percent between 0 and 100),
  applies_to_month date,
  created_at       timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy goals_owner on public.goals
  for all
  using   (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── Connected bank accounts (Open Finance, Phase 5) ───────────────────────────
-- Intentionally minimal; adapter details added when Phase 5 begins.

create table public.connected_accounts (
  id               uuid        primary key default gen_random_uuid(),
  owner_id         uuid        not null references public.users (id),
  provider         text        not null,
  provider_item_id text        not null,
  institution_name text        not null,
  connected_at     timestamptz not null default now(),
  last_synced_at   timestamptz,
  status           text        not null default 'active',
  unique (owner_id, provider, provider_item_id)
);

alter table public.connected_accounts enable row level security;

create policy connected_accounts_owner on public.connected_accounts
  for all
  using   (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
