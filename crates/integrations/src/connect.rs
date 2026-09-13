use chrono::{Duration, NaiveDate, Utc};
use oauth2::{AuthorizationCode, CsrfToken, PkceCodeChallenge, PkceCodeVerifier, RefreshToken, Scope, TokenResponse};
use reporta_common::metrics::{Provider, RawMetrics};
use reporta_common::{BreakdownSection, Config};
use reporta_crypto::TokenCipher;
use reporta_db::models::{AuditLog, Connection, OAuthState};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::IntegrationError;
use crate::oauth::{self, oauth_config_for};
use crate::providers;

const OAUTH_STATE_TTL_MINUTES: i64 = 10;
/// Refresh proactively this far before actual expiry to avoid a request
/// racing an access token that expires mid-flight.
const REFRESH_SKEW_SECONDS: i64 = 120;

pub struct ConnectionService {
    http: reqwest::Client,
}

impl Default for ConnectionService {
    fn default() -> Self {
        Self::new()
    }
}

impl ConnectionService {
    pub fn new() -> Self {
        Self {
            // Timeouts bound worst-case provider latency: without them a hung
            // Graph/GA4/Ads call would stall a report generation forever
            // (reqwest has NO default request timeout).
            http: reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_secs(10))
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("failed to build provider HTTP client"),
        }
    }

    fn redirect_uri(config: &Config, provider: Provider) -> String {
        format!("{}/api/v1/integrations/{}/callback", config.app_base_url, provider)
    }

    /// Builds the URL the frontend should redirect the browser to in order
    /// to start the OAuth consent flow, and records the CSRF-state + PKCE
    /// verifier server-side so the callback can validate them.
    ///
    /// `shop_domain` (e.g. `my-store.myshopify.com`) is required for, and only
    /// used by, Shopify — its authorize/token URLs are per-store.
    pub async fn start_authorization(
        &self,
        pool: &PgPool,
        config: &Config,
        user_id: Uuid,
        client_id: Uuid,
        provider: Provider,
        shop_domain: Option<String>,
    ) -> Result<String, IntegrationError> {
        let redirect_uri = Self::redirect_uri(config, provider);
        let oauth_cfg = oauth_config_for(provider, config).ok_or(IntegrationError::NotConfigured)?;

        // TikTok's authorize URL doesn't fit the generic OAuth2 client (see
        // oauth.rs) — no PKCE, no scope param, `app_id` instead of `client_id`.
        if provider == Provider::Tiktok {
            let state = Uuid::new_v4().to_string();
            let expires_at = Utc::now() + Duration::minutes(OAUTH_STATE_TTL_MINUTES);
            OAuthState::create(pool, &state, client_id, user_id, provider, "unused-tiktok-has-no-pkce", &redirect_uri, None, expires_at)
                .await?;

            let mut url = url::Url::parse(&oauth::auth_url_for(provider, None)?)?;
            url.query_pairs_mut()
                .append_pair("app_id", &oauth_cfg.client_id)
                .append_pair("state", &state)
                .append_pair("redirect_uri", &redirect_uri);
            return Ok(url.to_string());
        }

        if provider == Provider::Shopify && shop_domain.is_none() {
            return Err(IntegrationError::MissingShopDomain);
        }

        let client = oauth::build_client(provider, &oauth_cfg, &redirect_uri, shop_domain.as_deref())?;

        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
        let mut request = client.authorize_url(CsrfToken::new_random).set_pkce_challenge(pkce_challenge);
        let scope = oauth::scope_for(provider);
        if !scope.is_empty() {
            request = request.add_scope(Scope::new(scope.to_string()));
        }
        for (key, value) in oauth::extra_authorize_params(provider) {
            request = request.add_extra_param(key, value);
        }
        let (auth_url, csrf_token) = request.url();

        let expires_at = Utc::now() + Duration::minutes(OAUTH_STATE_TTL_MINUTES);
        OAuthState::create(
            pool,
            csrf_token.secret(),
            client_id,
            user_id,
            provider,
            pkce_verifier.secret(),
            &redirect_uri,
            shop_domain.as_deref(),
            expires_at,
        )
        .await?;

        Ok(auth_url.to_string())
    }

    /// Completes the OAuth flow: validates + consumes the one-time state,
    /// exchanges the code for tokens, resolves the account to report on, and
    /// stores everything encrypted.
    pub async fn handle_callback(
        &self,
        pool: &PgPool,
        config: &Config,
        cipher: &TokenCipher,
        state: &str,
        code: &str,
    ) -> Result<Connection, IntegrationError> {
        let oauth_state = OAuthState::take_by_state(pool, state)
            .await?
            .ok_or(IntegrationError::InvalidState)?;
        let provider = oauth_state.provider;
        let oauth_cfg = oauth_config_for(provider, config).ok_or(IntegrationError::NotConfigured)?;

        // TikTok's token exchange returns a TikTok-specific JSON envelope, not
        // a standard OAuth token response, so it can't go through the shared
        // `oauth2`-crate client below.
        if provider == Provider::Tiktok {
            let (access_token, account) =
                providers::tiktok::exchange_code(&self.http, &oauth_cfg.client_id, &oauth_cfg.client_secret, code)
                    .await?;
            return self
                .finish_connection(pool, cipher, &oauth_state, access_token, None, None, account)
                .await;
        }

        let client =
            oauth::build_client(provider, &oauth_cfg, &oauth_state.redirect_uri, oauth_state.shop_domain.as_deref())?;

        let token = client
            .exchange_code(AuthorizationCode::new(code.to_string()))
            .set_pkce_verifier(PkceCodeVerifier::new(oauth_state.pkce_verifier.clone()))
            .request_async(&self.http)
            .await
            .map_err(|e| IntegrationError::ExchangeFailed(e.to_string()))?;

        let mut access_token = token.access_token().secret().clone();
        let mut refresh_token = token.refresh_token().map(|t| t.secret().clone());
        let mut expires_at = token
            .expires_in()
            .map(|d| Utc::now() + Duration::seconds(d.as_secs() as i64));

        let account: Option<(String, Option<String>)> = match provider {
            Provider::Meta => {
                let (long_lived, expires_in) = providers::meta::exchange_for_long_lived_token(
                    &self.http,
                    &oauth_cfg.client_id,
                    &oauth_cfg.client_secret,
                    &access_token,
                )
                .await?;
                access_token = long_lived;
                refresh_token = None;
                expires_at = expires_in.map(|s| Utc::now() + Duration::seconds(s));
                providers::meta::fetch_primary_ad_account(&self.http, &access_token).await?
            }
            Provider::Ga4 => providers::ga4::fetch_primary_property(&self.http, &access_token).await?,
            Provider::GoogleAds => {
                let developer_token = config
                    .google_ads_developer_token
                    .as_deref()
                    .ok_or(IntegrationError::NotConfigured)?;
                providers::google_ads::fetch_primary_customer(&self.http, &access_token, developer_token).await?
            }
            Provider::SearchConsole => providers::search_console::fetch_primary_site(&self.http, &access_token).await?,
            // The shop domain is the account — chosen by the user before the
            // OAuth redirect even started, not discovered afterward.
            Provider::Shopify => oauth_state.shop_domain.clone().map(|shop| (shop, None)),
            Provider::Linkedin => providers::linkedin::fetch_primary_ad_account(&self.http, &access_token).await?,
            Provider::Tiktok => unreachable!("handled above"),
        };

        self.finish_connection(pool, cipher, &oauth_state, access_token, refresh_token, expires_at, account).await
    }

    /// Shared tail of the OAuth flow for every provider: validates the
    /// resolved account exists, encrypts and stores the tokens, and writes the
    /// audit log entry. Split out so TikTok's bespoke exchange (which never
    /// touches the generic `oauth2` client above) can share it.
    #[allow(clippy::too_many_arguments)]
    async fn finish_connection(
        &self,
        pool: &PgPool,
        cipher: &TokenCipher,
        oauth_state: &OAuthState,
        access_token: String,
        refresh_token: Option<String>,
        expires_at: Option<chrono::DateTime<Utc>>,
        account: Option<(String, Option<String>)>,
    ) -> Result<Connection, IntegrationError> {
        let provider = oauth_state.provider;
        let (external_account_id, external_account_name) = match account {
            Some((id, name)) => (Some(id), name),
            // Fail fast here rather than storing a connection row whose
            // missing account id only blows up later, mid-report-generation,
            // as an unrelated-looking "connection not found".
            None => {
                tracing::warn!(?provider, "OAuth succeeded but provider returned no accessible account");
                return Err(IntegrationError::NoAccessibleAccount);
            }
        };

        let access_enc = cipher.encrypt(&access_token)?;
        let refresh_enc = match &refresh_token {
            Some(rt) => Some(cipher.encrypt(rt)?),
            None => None,
        };

        let scopes: Vec<String> = vec![oauth::scope_for(provider).to_string()];

        let connection = Connection::upsert(
            pool,
            oauth_state.client_id,
            provider,
            external_account_id.as_deref(),
            external_account_name.as_deref(),
            &access_enc.ciphertext,
            &access_enc.nonce,
            refresh_enc.as_ref().map(|e| e.ciphertext.as_slice()),
            refresh_enc.as_ref().map(|e| e.nonce.as_slice()),
            &scopes,
            expires_at,
        )
        .await?;

        // Same best-effort contract as the API layer's audit helper: an audit
        // write must never fail the connect it's describing. This is recorded
        // here (not in the route) because the OAuth state row — already
        // consumed above — is what knows *which user* completed the flow.
        if let Err(e) = AuditLog::record(
            pool,
            Some(oauth_state.user_id),
            "integration.connected",
            Some("connection"),
            Some(connection.id),
            serde_json::json!({
                "client_id": oauth_state.client_id,
                "provider": provider,
                "external_account_name": external_account_name,
            }),
            None,
        )
        .await
        {
            tracing::warn!(error = ?e, "failed to write audit log");
        }

        Ok(connection)
    }

    /// Returns a valid (refreshing if needed) decrypted access token for a
    /// connection, along with the developer token where required.
    async fn valid_access_token(
        &self,
        pool: &PgPool,
        config: &Config,
        cipher: &TokenCipher,
        connection: &Connection,
    ) -> Result<String, IntegrationError> {
        let needs_refresh = connection
            .expires_at
            .map(|exp| exp <= Utc::now() + Duration::seconds(REFRESH_SKEW_SECONDS))
            .unwrap_or(false);

        if !needs_refresh {
            return cipher
                .decrypt(&connection.access_token_encrypted, &connection.access_token_nonce)
                .map_err(IntegrationError::from);
        }

        let Some(refresh_ct) = &connection.refresh_token_encrypted else {
            return Err(IntegrationError::RefreshFailed(
                "no refresh token on file; the client must reconnect this account".to_string(),
            ));
        };
        let refresh_nonce = connection
            .refresh_token_nonce
            .as_ref()
            .ok_or_else(|| IntegrationError::RefreshFailed("missing refresh token nonce".to_string()))?;
        let refresh_token = cipher.decrypt(refresh_ct, refresh_nonce)?;

        let oauth_cfg = oauth_config_for(connection.provider, config).ok_or(IntegrationError::NotConfigured)?;
        let redirect_uri = Self::redirect_uri(config, connection.provider);
        // Shopify's connection stores the shop domain as its account id (it
        // IS the account); every other provider ignores this.
        let shop_domain =
            (connection.provider == Provider::Shopify).then(|| connection.external_account_id.as_deref()).flatten();
        let client = oauth::build_client(connection.provider, &oauth_cfg, &redirect_uri, shop_domain)?;

        let token = client
            .exchange_refresh_token(&RefreshToken::new(refresh_token))
            .request_async(&self.http)
            .await
            .map_err(|e| IntegrationError::RefreshFailed(e.to_string()))?;

        let new_access_token = token.access_token().secret().clone();
        let new_expires_at = token
            .expires_in()
            .map(|d| Utc::now() + Duration::seconds(d.as_secs() as i64));
        let new_refresh_token = token.refresh_token().map(|t| t.secret().clone());

        let access_enc = cipher.encrypt(&new_access_token)?;
        let refresh_enc = match &new_refresh_token {
            Some(rt) => Some(cipher.encrypt(rt)?),
            None => None,
        };

        Connection::upsert(
            pool,
            connection.client_id,
            connection.provider,
            connection.external_account_id.as_deref(),
            connection.external_account_name.as_deref(),
            &access_enc.ciphertext,
            &access_enc.nonce,
            refresh_enc.as_ref().map(|e| e.ciphertext.as_slice()),
            refresh_enc.as_ref().map(|e| e.nonce.as_slice()),
            &connection.scopes,
            new_expires_at,
        )
        .await?;

        Ok(new_access_token)
    }

    /// Pulls normalized metrics for one connected account over a date range,
    /// refreshing the access token first if it's expired or about to be.
    pub async fn fetch_metrics(
        &self,
        pool: &PgPool,
        config: &Config,
        cipher: &TokenCipher,
        connection: &Connection,
        period_start: NaiveDate,
        period_end: NaiveDate,
    ) -> Result<RawMetrics, IntegrationError> {
        let access_token = self.valid_access_token(pool, config, cipher, connection).await?;
        let account_id = connection
            .external_account_id
            .as_deref()
            .ok_or(IntegrationError::NoAccessibleAccount)?;

        let metrics = match connection.provider {
            Provider::Meta => {
                providers::meta::fetch_metrics(&self.http, &access_token, account_id, period_start, period_end)
                    .await?
            }
            Provider::Ga4 => {
                providers::ga4::fetch_metrics(&self.http, &access_token, account_id, period_start, period_end)
                    .await?
            }
            Provider::GoogleAds => {
                let developer_token = config
                    .google_ads_developer_token
                    .as_deref()
                    .ok_or(IntegrationError::NotConfigured)?;
                providers::google_ads::fetch_metrics(
                    &self.http,
                    &access_token,
                    developer_token,
                    account_id,
                    period_start,
                    period_end,
                )
                .await?
            }
            Provider::SearchConsole => {
                providers::search_console::fetch_metrics(&self.http, &access_token, account_id, period_start, period_end)
                    .await?
            }
            Provider::Shopify => {
                providers::shopify::fetch_metrics(&self.http, &access_token, account_id, period_start, period_end)
                    .await?
            }
            Provider::Tiktok => {
                providers::tiktok::fetch_metrics(&self.http, &access_token, account_id, period_start, period_end)
                    .await?
            }
            Provider::Linkedin => {
                providers::linkedin::fetch_metrics(&self.http, &access_token, account_id, period_start, period_end)
                    .await?
            }
        };

        Connection::mark_synced(pool, connection.id).await?;
        Ok(metrics)
    }

    /// Segment breakdowns (traffic by channel/device/page, ad spend by
    /// campaign) that let the report's AI analysis speak to *this* account
    /// specifically. Best-effort: a provider that errors here yields an empty
    /// list — the headline metrics and the report still succeed.
    pub async fn fetch_breakdowns(
        &self,
        pool: &PgPool,
        config: &Config,
        cipher: &TokenCipher,
        connection: &Connection,
        cur_start: NaiveDate,
        cur_end: NaiveDate,
        prev_start: NaiveDate,
        prev_end: NaiveDate,
    ) -> Vec<BreakdownSection> {
        let Ok(access_token) = self.valid_access_token(pool, config, cipher, connection).await else {
            return Vec::new();
        };
        let Some(account_id) = connection.external_account_id.as_deref() else {
            return Vec::new();
        };

        match connection.provider {
            Provider::Meta => {
                providers::meta::fetch_breakdowns(
                    &self.http, &access_token, account_id, cur_start, cur_end, prev_start, prev_end,
                )
                .await
            }
            Provider::Ga4 => {
                providers::ga4::fetch_breakdowns(
                    &self.http, &access_token, account_id, cur_start, cur_end, prev_start, prev_end,
                )
                .await
            }
            Provider::GoogleAds => {
                let Some(developer_token) = config.google_ads_developer_token.as_deref() else {
                    return Vec::new();
                };
                providers::google_ads::fetch_breakdowns(
                    &self.http, &access_token, developer_token, account_id, cur_start, cur_end, prev_start,
                    prev_end,
                )
                .await
            }
            // Not built yet for the newer sources — the headline metrics for
            // each already work; per-segment detail (e.g. Search Console
            // queries/pages, Shopify top products, TikTok/LinkedIn campaigns)
            // is a natural follow-up in the same shape as the ones above.
            Provider::SearchConsole | Provider::Shopify | Provider::Tiktok | Provider::Linkedin => Vec::new(),
        }
    }
}
