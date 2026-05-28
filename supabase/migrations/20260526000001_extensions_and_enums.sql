-- Migration 001: Extensions and base enum types
-- All enums live here so subsequent migrations can reference them without ordering issues.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Subscription plan tiers
create type plan_type as enum ('free', 'pro', 'family');

-- How a shared expense is divided among household members (ADR-006, §4.4)
-- Values are person-agnostic: ONLY_PAYER / ONLY_OTHER, never ONLY_LUCAS / ONLY_JULIA
create type split_rule_type as enum ('EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM');

-- 50/30/20 budget classification
create type budget_bucket as enum ('needs', 'wants', 'savings');

-- Budget goal variants
create type goal_type as enum ('MAX_NEEDS', 'MAX_WANTS', 'MIN_SAVINGS', 'MIN_SURPLUS');

-- Household membership roles
create type member_role as enum ('owner', 'member');
