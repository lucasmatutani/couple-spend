-- Migration 010: Recurring expense templates (household + individual)
--
-- These tables store templates, not real expense instances.
-- The "apply" action in the app creates real entries in expenses / personal_expenses.

-- ── Household recurring expenses ─────────────────────────────────────────────

create table public.recurring_expenses (
  id                       uuid            primary key default gen_random_uuid(),
  household_id             uuid            not null references public.households(id) on delete cascade,
  paid_by                  uuid            not null references public.users(id),
  category_id              uuid            not null references public.categories(id),
  amount_cents             bigint          not null check (amount_cents > 0),
  description              text            not null,
  split_rule_type          split_rule_type not null,
  split_rule_payer_percent int             check (split_rule_payer_percent between 0 and 100),
  active                   boolean         not null default true,
  created_at               timestamptz     not null default now(),
  constraint recurring_expenses_custom_payer_percent_check
    check (
      (split_rule_type = 'CUSTOM' and split_rule_payer_percent is not null)
      or (split_rule_type <> 'CUSTOM')
    )
);

alter table public.recurring_expenses enable row level security;

-- All household members can read recurring expense templates
create policy recurring_expenses_select on public.recurring_expenses
  for select using (public.is_household_member(household_id));

-- Any member can create a template (paid_by must be themselves, enforced by policy)
create policy recurring_expenses_insert on public.recurring_expenses
  for insert with check (
    public.is_household_member(household_id)
    and paid_by = auth.uid()
  );

-- Only creator can delete their own template
create policy recurring_expenses_delete on public.recurring_expenses
  for delete using (paid_by = auth.uid());

-- ── Individual recurring expenses ─────────────────────────────────────────────

create table public.recurring_personal_expenses (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null references public.users(id) on delete cascade,
  category_id  uuid        not null references public.categories(id),
  amount_cents bigint      not null check (amount_cents > 0),
  description  text        not null,
  active       boolean     not null default true,
  created_at   timestamptz not null default now()
);

alter table public.recurring_personal_expenses enable row level security;

create policy recurring_personal_expenses_all on public.recurring_personal_expenses
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
