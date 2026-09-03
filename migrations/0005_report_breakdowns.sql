-- Segment breakdowns (traffic by channel/device/page, ad spend by campaign)
-- pulled at generation time. Fed to the AI so its analysis is specific to the
-- account, persisted so the frontend and PDF render the same detail.
alter table reports add column if not exists breakdowns_json jsonb;
