-- Migration 026: Remove categories.default_split_rule
--
-- Stored per category since migration 004 but never read by any use case or
-- UI to actually prefill an expense's split rule — dead data. The split rule
-- that matters is the one chosen per expense (expenses.split_rule_type),
-- which is untouched by this migration.

alter table public.categories drop column default_split_rule;
