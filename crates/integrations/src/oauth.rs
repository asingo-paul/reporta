use oauth2::basic::BasicClient;
use oauth2::{AuthUrl, ClientId, ClientSecret, RedirectUrl, TokenUrl};
use reporta_common::metrics::Provider;

use crate::error::IntegrationError;

/// Everything needed to build an OAuth2 client for one provider, sourced
/// from `Config` (which itself only ever reads from the process environment
/// — no credential here is guessed or fabricated).
pub struct ProviderOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
}

/// TikTok's Marketing API OAuth deliberately does NOT go through this module:
/// its authorize URL uses `app_id` instead of `client_id`, omits
/// `response_type`/`scope` entirely, and its token exchange returns a
/// TikTok-specific JSON envelope (`{code, data: {access_token, ...}}`) rather
/// than a standard OAuth token response — none of which the generic `oauth2`
/// crate client used here can produce or parse. See `providers::tiktok` and
/// `ConnectionService`'s TikTok branches for its bespoke flow.
pub fn oauth_config_for(provider: Provider, config: &reporta_common::Config) -> Option<ProviderOAuthConfig> {
    match provider {
        Provider::Meta => Some(ProviderOAuthConfig {
            client_id: config.meta_app_id.clone()?,
            client_secret: config.meta_app_secret.clone()?,
        }),
        Provider::Ga4 | Provider::GoogleAds | Provider::SearchConsole => Some(ProviderOAuthConfig {
            client_id: config.google_client_id.clone()?,
            client_secret: config.google_client_secret.clone()?,
        }),
        Provider::Shopify => Some(ProviderOAuthConfig {
            client_id: config.shopify_client_id.clone()?,
            client_secret: config.shopify_client_secret.clone()?,
        }),
        Provider::Linkedin => Some(ProviderOAuthConfig {
            client_id: config.linkedin_client_id.clone()?,
            client_secret: config.linkedin_client_secret.clone()?,
        }),
        Provider::Tiktok => Some(ProviderOAuthConfig {
            client_id: config.tiktok_app_id.clone()?,
            client_secret: config.tiktok_app_secret.clone()?,
        }),
    }
}

/// Shopify's authorize/token URLs are per-store (`{shop}.myshopify.com`), so
/// `shop_domain` is required for it and ignored for every other provider.
pub fn auth_url_for(provider: Provider, shop_domain: Option<&str>) -> Result<String, IntegrationError> {
    Ok(match provider {
        Provider::Meta => "https://www.facebook.com/v21.0/dialog/oauth".to_string(),
        Provider::Ga4 | Provider::GoogleAds | Provider::SearchConsole => {
            "https://accounts.google.com/o/oauth2/v2/auth".to_string()
        }
        Provider::Linkedin => "https://www.linkedin.com/oauth/v2/authorization".to_string(),
        Provider::Shopify => {
            format!("https://{}/admin/oauth/authorize", shop_domain.ok_or(IntegrationError::MissingShopDomain)?)
        }
        Provider::Tiktok => "https://business-api.tiktok.com/portal/auth".to_string(),
    })
}

pub fn token_url_for(provider: Provider, shop_domain: Option<&str>) -> Result<String, IntegrationError> {
    Ok(match provider {
        Provider::Meta => "https://graph.facebook.com/v21.0/oauth/access_token".to_string(),
        Provider::Ga4 | Provider::GoogleAds | Provider::SearchConsole => {
            "https://oauth2.googleapis.com/token".to_string()
        }
        Provider::Linkedin => "https://www.linkedin.com/oauth/v2/accessToken".to_string(),
        Provider::Shopify => {
            format!("https://{}/admin/oauth/access_token", shop_domain.ok_or(IntegrationError::MissingShopDomain)?)
        }
        Provider::Tiktok => "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/".to_string(),
    })
}

/// Scope requested for each provider. Deliberately the minimum needed for
/// read-only reporting (least-privilege): no write/management scopes.
/// TikTok's scopes are configured on the app itself in the TikTok developer
/// portal, not passed in the authorize URL.
pub fn scope_for(provider: Provider) -> &'static str {
    match provider {
        Provider::Meta => "ads_read",
        Provider::Ga4 => "https://www.googleapis.com/auth/analytics.readonly",
        Provider::GoogleAds => "https://www.googleapis.com/auth/adwords",
        Provider::SearchConsole => "https://www.googleapis.com/auth/webmasters.readonly",
        Provider::Shopify => "read_orders,read_products",
        Provider::Linkedin => "r_ads r_ads_reporting",
        Provider::Tiktok => "",
    }
}

/// Extra query params to force a refresh token out of Google (which by
/// default only issues one on the very first consent).
pub fn extra_authorize_params(provider: Provider) -> Vec<(&'static str, &'static str)> {
    match provider {
        Provider::Ga4 | Provider::GoogleAds | Provider::SearchConsole => {
            vec![("access_type", "offline"), ("prompt", "consent")]
        }
        Provider::Meta | Provider::Shopify | Provider::Linkedin | Provider::Tiktok => vec![],
    }
}

pub type ConfiguredClient = BasicClient<
    oauth2::EndpointSet,
    oauth2::EndpointNotSet,
    oauth2::EndpointNotSet,
    oauth2::EndpointNotSet,
    oauth2::EndpointSet,
>;

/// Builds an OAuth2 client for any provider except TikTok (see the note on
/// `oauth_config_for`). `shop_domain` is required for, and only used by,
/// Shopify.
pub fn build_client(
    provider: Provider,
    oauth_cfg: &ProviderOAuthConfig,
    redirect_uri: &str,
    shop_domain: Option<&str>,
) -> Result<ConfiguredClient, IntegrationError> {
    let client = BasicClient::new(ClientId::new(oauth_cfg.client_id.clone()))
        .set_client_secret(ClientSecret::new(oauth_cfg.client_secret.clone()))
        .set_auth_uri(AuthUrl::new(auth_url_for(provider, shop_domain)?)?)
        .set_token_uri(TokenUrl::new(token_url_for(provider, shop_domain)?)?)
        .set_redirect_uri(RedirectUrl::new(redirect_uri.to_string())?);
    Ok(client)
}
