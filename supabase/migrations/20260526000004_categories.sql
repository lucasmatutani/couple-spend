-- Migration 004: Categories and global template seed
--
-- Categories are either:
--   household_id IS NULL → global template, visible to everyone, managed by system
--   household_id = <id>  → household-specific custom category, managed by owner

create table public.categories (
  id                 uuid           primary key default gen_random_uuid(),
  household_id       uuid           references public.households (id),
  parent_id          uuid           references public.categories (id),
  name               text           not null,
  budget_bucket      budget_bucket  not null,
  default_split_rule split_rule_type not null default 'EQUAL',
  is_template        boolean        not null default false
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.categories enable row level security;

-- Global templates (household_id IS NULL) are readable by everyone.
-- Household-specific categories are readable only by members of that household.
create policy categories_select on public.categories
  for select
  using (
    household_id is null
    or public.is_household_member(household_id)
  );

-- Only household owners can create custom categories for their household.
-- Global templates are seeded by migrations (no user INSERT policy needed for them).
create policy categories_insert on public.categories
  for insert
  with check (
    household_id is not null
    and public.is_household_owner(household_id)
  );

create policy categories_update on public.categories
  for update
  using (
    household_id is not null
    and public.is_household_owner(household_id)
  );

create policy categories_delete on public.categories
  for delete
  using (
    household_id is not null
    and public.is_household_owner(household_id)
  );

-- ── Global template seed (SPEC §15.1) ────────────────────────────────────────
-- household_id = NULL means global template; is_template = true.
-- Default split rules follow the spec table; Entertainment/Clothing default to
-- ONLY_PAYER because they are typically personal choices paid by one member.
insert into public.categories (name, budget_bucket, default_split_rule, is_template) values
  ('Moradia',       'needs',   'EQUAL',       true),
  ('Serviços',      'needs',   'EQUAL',       true),
  ('Mercado',       'needs',   'EQUAL',       true),
  ('Transporte',    'needs',   'EQUAL',       true),
  ('Saúde',         'needs',   'EQUAL',       true),
  ('Educação',      'needs',   'EQUAL',       true),
  ('Assinaturas',   'wants',   'EQUAL',       true),
  ('Lazer',         'wants',   'ONLY_PAYER',  true),
  ('Roupas',        'wants',   'ONLY_PAYER',  true),
  ('Restaurantes',  'wants',   'EQUAL',       true),
  ('Investimentos', 'savings', 'EQUAL',       true),
  ('Reembolsos',    'needs',   'EQUAL',       true),
  ('Outros',        'needs',   'EQUAL',       true);
