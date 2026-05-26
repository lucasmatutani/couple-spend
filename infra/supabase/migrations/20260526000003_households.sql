-- Migration 003: Households, membership, and security helper functions
--
-- Design note: RLS policies on household_members would be self-referential
-- if they queried the same table directly. We break the cycle with
-- `security definer` functions that bypass RLS when checking membership.
-- Pattern described in Supabase docs under "Recursive RLS".

-- ── Tables ───────────────────────────────────────────────────────────────────

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid        not null references public.households (id) on delete cascade,
  user_id      uuid        not null references public.users (id),
  role         member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- ── Security-definer helper functions ────────────────────────────────────────
-- These run as the function owner (postgres) and therefore bypass RLS.
-- They are the single source of truth for membership checks used by ALL
-- subsequent RLS policies. Centralising here avoids policy drift.

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and user_id      = auth.uid()
  );
$$;

create or replace function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and user_id      = auth.uid()
      and role         = 'owner'
  );
$$;

-- Returns all household_id values the current user belongs to.
-- Used in policies that need IN / = ANY checks.
create or replace function public.get_my_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

-- ── Trigger: creator automatically becomes owner ──────────────────────────────
-- Runs security definer so it can insert into household_members even before
-- the creator has any membership row (which would otherwise block the insert
-- via the owner-only INSERT policy).
create or replace function public.add_household_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger household_creator_becomes_owner
  after insert on public.households
  for each row
  execute function public.add_household_creator_as_owner();

-- ── RLS: households ──────────────────────────────────────────────────────────
alter table public.households enable row level security;

create policy households_select on public.households
  for select
  using (public.is_household_member(id));

create policy households_insert on public.households
  for insert
  with check (created_by = auth.uid());

create policy households_update on public.households
  for update
  using (public.is_household_owner(id));

-- ── RLS: household_members ────────────────────────────────────────────────────
alter table public.household_members enable row level security;

-- Members can see all members of their own households (used to display team).
create policy household_members_select on public.household_members
  for select
  using (public.is_household_member(household_id));

-- Only owners can add new members.
create policy household_members_insert on public.household_members
  for insert
  with check (public.is_household_owner(household_id));

-- Only owners can remove members.
create policy household_members_delete on public.household_members
  for delete
  using (public.is_household_owner(household_id));

-- ── Extend users RLS: household peer visibility ───────────────────────────────
-- Added here (not in 002) because it depends on get_my_household_ids()
-- and household_members existing first.
create policy users_select_household_peers on public.users
  for select
  using (
    exists (
      select 1 from public.household_members hm
      where hm.user_id      = id                              -- the user being evaluated
        and hm.household_id = any(public.get_my_household_ids())  -- shares a household with me
    )
  );
