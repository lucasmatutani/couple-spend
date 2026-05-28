-- Migration 005: Shared expenses (household-scoped)
--
-- amount_cents > 0 always. Sign lives in the table type, not the value (ADR-003).
-- The unique constraint on (household_id, source_id, external_id) enforces
-- import idempotency: importing the same OFX/CSV file twice is a no-op.

create table public.expenses (
  id                       uuid            primary key default gen_random_uuid(),
  household_id             uuid            not null references public.households (id),
  paid_by                  uuid            not null references public.users (id),
  category_id              uuid            not null references public.categories (id),
  occurred_at              date            not null,
  amount_cents             bigint          not null check (amount_cents > 0),
  description              text,
  split_rule_type          split_rule_type not null,
  split_rule_payer_percent int             check (split_rule_payer_percent between 0 and 100),
  source_id                text            not null default 'manual',
  external_id              text            not null default gen_random_uuid()::text,
  imported_at              timestamptz     not null default now(),
  unique (household_id, source_id, external_id)
);

-- CUSTOM split requires payer_percent; all others must not set it.
-- Enforced here so the constraint lives at the DB level, not only in app code.
alter table public.expenses add constraint expenses_custom_payer_percent_check
  check (
    (split_rule_type = 'CUSTOM' and split_rule_payer_percent is not null)
    or
    (split_rule_type <> 'CUSTOM')
  );

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.expenses enable row level security;

-- All members of the household can read all its expenses.
create policy expenses_select on public.expenses
  for select
  using (public.is_household_member(household_id));

-- Any member can record an expense, but paid_by must be themselves.
create policy expenses_insert on public.expenses
  for insert
  with check (
    public.is_household_member(household_id)
    and paid_by = auth.uid()
  );

-- Only the payer can edit or delete their own expense entries.
create policy expenses_update on public.expenses
  for update
  using (paid_by = auth.uid())
  with check (paid_by = auth.uid());

create policy expenses_delete on public.expenses
  for delete
  using (paid_by = auth.uid());
