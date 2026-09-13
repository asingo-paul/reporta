import { BarChart2, Target, Share2, Search, ShoppingBag, Music2, Linkedin } from 'lucide-react';

// Single source of truth for how each connectable data source is presented in
// the UI (icon + display name). Used by the client connections grid, the
// "connected sources" badges on Generate Report, and the OAuth callback's
// success/diagnostic messages — previously each of those hardcoded its own
// copy of this list.
export const PROVIDER_META = {
  ga4: { name: 'Google Analytics 4', icon: BarChart2 },
  google_ads: { name: 'Google Ads', icon: Target },
  meta: { name: 'Meta (Facebook/Instagram)', icon: Share2 },
  search_console: { name: 'Google Search Console', icon: Search },
  shopify: { name: 'Shopify', icon: ShoppingBag },
  tiktok: { name: 'TikTok Ads', icon: Music2 },
  linkedin: { name: 'LinkedIn Ads', icon: Linkedin },
};

export const PROVIDER_IDS = Object.keys(PROVIDER_META);

export function providerName(id) {
  return PROVIDER_META[id]?.name || id?.toUpperCase() || 'this provider';
}
