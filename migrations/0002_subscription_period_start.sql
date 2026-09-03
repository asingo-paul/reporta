-- Track the start of the current billing period alongside its end, so a
-- completed payment can be validated against exactly the window it paid for
-- (not just "has some end date"). Backfills cleanly: existing rows simply
-- have a NULL start until their next Stripe webhook refreshes them.
alter table subscriptions add column if not exists current_period_start timestamptz;
