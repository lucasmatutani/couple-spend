-- Migration 002: Public users table mirroring auth.users
-- Stores app-level profile fields that Supabase Auth does not provide.
-- The only writer is the trigger below; direct INSERTs are blocked by RLS.

create table public.users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text not null,
  email              text not null,
  plan               plan_type not null default 'free',
  stripe_customer_id text,
  trial_ends_at      timestamptz,
  created_at         timestamptz not null default now()
);

-- ── Trigger: mirror every auth signup into public.users ─────────────────────
-- security definer runs as the function owner (postgres), bypassing RLS.
-- This is intentional: at signup time there is no active user session yet.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)   -- fallback: local part of the email
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.users enable row level security;

-- Users can always read and update their own row.
create policy users_select_self on public.users
  for select
  using (auth.uid() = id);

create policy users_update_self on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- NOTE: the policy that lets users see other household members
-- (users_select_household_peers) is added in migration 003, after
-- the helper functions and household_members table exist.
