-- Migration 009: Stripe webhook event log for idempotency
-- Stores processed Stripe event IDs to prevent double-processing on retries.
-- Uses service-role client in the webhook handler (bypasses RLS).

create table public.stripe_webhook_events (
  event_id     text        primary key,
  processed_at timestamptz not null default now()
);

-- No RLS needed: only the service-role client writes here (webhook handler).
-- No user session exists in that context.
