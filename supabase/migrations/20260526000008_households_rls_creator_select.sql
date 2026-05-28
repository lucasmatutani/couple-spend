-- Migration 008: Add creator-based SELECT policy for households
--
-- Problem: PostgreSQL 15+ changed INSERT RETURNING behaviour with RLS.
-- When `INSERT INTO households RETURNING *` is executed by PostgREST, the SELECT
-- USING policy (is_household_member) is evaluated after the AFTER INSERT trigger
-- adds the creator to household_members. However, the planner may evaluate the
-- STABLE function is_household_member before the trigger's snapshot is visible,
-- returning false and causing PostgreSQL to raise "new row violates row-level
-- security policy for table households" instead of silently filtering.
--
-- Fix: add a second permissive SELECT policy that allows the creator to always
-- see their own household. Multiple permissive policies are OR-ed together, so
-- the effective check becomes: is_household_member(id) OR created_by = auth.uid().
-- This ensures INSERT RETURNING succeeds even in the edge case above.

create policy households_select_creator on public.households
  for select
  using (created_by = auth.uid());
