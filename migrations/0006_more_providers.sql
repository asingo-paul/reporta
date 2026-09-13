-- Four more data sources: Google Search Console (organic search), Shopify
-- (commerce), TikTok Ads and LinkedIn Ads (both same shape as Meta/Google Ads).
alter type provider add value if not exists 'search_console';
alter type provider add value if not exists 'shopify';
alter type provider add value if not exists 'tiktok';
alter type provider add value if not exists 'linkedin';

-- Shopify's OAuth authorize/token URLs are per-store, chosen before the
-- redirect (unlike every other provider here) — carry the shop domain across
-- the round trip to the callback.
alter table oauth_states add column if not exists shop_domain text;
