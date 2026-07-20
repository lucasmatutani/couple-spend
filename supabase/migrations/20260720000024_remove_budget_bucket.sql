-- Migration 024: Remove budget_bucket entirely
--
-- budget_bucket (needs/wants/savings) was never used correctly and is being
-- dropped as a feature for now. MAX_NEEDS/MAX_WANTS goals read pctByBucket,
-- which was computed from this column — without it those goal types have no
-- signal, so they are removed too. MIN_SAVINGS (pctInvested) and MIN_SURPLUS
-- are unaffected.

-- Drop goals that can no longer be evaluated.
delete from public.goals where goal_type in ('MAX_NEEDS', 'MAX_WANTS');

-- Narrow goal_type enum.
alter type goal_type rename to goal_type_old;
create type goal_type as enum ('MIN_SAVINGS', 'MIN_SURPLUS');

alter table public.goals
  alter column goal_type type goal_type using goal_type::text::goal_type;

drop type goal_type_old;

-- Drop budget_bucket entirely.
alter table public.categories drop column budget_bucket;
drop type budget_bucket;
