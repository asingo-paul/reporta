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

pub fn oauth_config_for(
    provider: Provider,
    config: &reporta_common::Config,
) -> Option<ProviderOAuthConfig> {
    match provider {
        Provider::Meta => Some(ProviderOAuthConfig {
            client_id: config.meta_app_id.clone()?,
            client_secret: config.meta_app_secret.clone()?,
        }),
        Provider::Ga4 | Provider::GoogleAds => Some(ProviderOAuthConfig {
            client_id: config.google_client_id.clone()?,
            client_secret: config.google_client_secret.clone()?,
        }),
    }
}

pub fn auth_url_for(provider: Provider) -> &'static str {
    match provider {
        Provider::Meta => "https://www.facebook.com/v21.0/dialog/oauth",
        Provider::Ga4 | Provider::GoogleAds => "https://accounts.google.com/o/oauth2/v2/auth",
    }
}

pub fn token_url_for(provider: Provider) -> &'static str {
    match provider {
        Provider::Meta => "https://graph.facebook.com/v21.0/oauth/access_token",
        Provider::Ga4 | Provider::GoogleAds => "https://oauth2.googleapis.com/token",
    }
}

/// Scope requested for each provider. Deliberately the minimum needed for
/// read-only reporting (least-privilege): no write/management scopes.
pub fn scope_for(provider: Provider) -> &'static str {
    match provider {
        Provider::Meta => "ads_read",
        Provider::Ga4 => "https://www.googleapis.com/auth/analytics.readonly",
        Provider::GoogleAds => "https://www.googleapis.com/auth/adwords",
    }
}

/// Extra query params to force a refresh token out of Google (which by
/// default only issues one on the very first consent).
pub fn extra_authorize_params(provider: Provider) -> Vec<(&'static str, &'static str)> {
    match provider {
        Provider::Ga4 | Provider::GoogleAds => {
            vec![("access_type", "offline"), ("prompt", "consent")]
        }
        Provider::Meta => vec![],
    }
}

pub type ConfiguredClient = BasicClient<
    oauth2::EndpointSet,
    oauth2::EndpointNotSet,
    oauth2::EndpointNotSet,
    oauth2::EndpointNotSet,
    oauth2::EndpointSet,
>;

pub fn build_client(
    provider: Provider,
    oauth_cfg: &ProviderOAuthConfig,
    redirect_uri: &str,
) -> Result<ConfiguredClient, IntegrationError> {
    let client = BasicClient::new(ClientId::new(oauth_cfg.client_id.clone()))
        .set_client_secret(ClientSecret::new(oauth_cfg.client_secret.clone()))
        .set_auth_uri(AuthUrl::new(auth_url_for(provider).to_string())?)
        .set_token_uri(TokenUrl::new(token_url_for(provider).to_string())?)
        .set_redirect_uri(RedirectUrl::new(redirect_uri.to_string())?);
    Ok(client)
}
