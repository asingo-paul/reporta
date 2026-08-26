use chrono::{Duration, NaiveDate, Utc};
use oauth2::{AuthorizationCode, CsrfToken, PkceCodeChallenge, PkceCodeVerifier, RefreshToken, Scope, TokenResponse};
use reporta_common::metrics::{Provider, RawMetrics};
use reporta_common::Config;
use reporta_crypto::TokenCipher;
use reporta_db::models::{Connection, OAuthState};
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
            http: reqwest::Client::new(),
        }
    }

    fn redirect_uri(config: &Config, provider: Provider) -> String {
        format!("{}/api/v1/integrations/{}/callback", config.app_base_url, provider)
    }

    /// Builds the URL the frontend should redirect the browser to in order
    /// to start the OAuth consent flow, and records the CSRF-state + PKCE
    /// verifier server-side so the callback can validate them.
    pub async fn start_authorization(
        &self,
        pool: &PgPool,
        config: &Config,
        user_id: Uuid,
        client_id: Uuid,
        provider: Provider,
    ) -> Result<String, IntegrationError> {
        let oauth_cfg = oauth_config_for(provider, config).ok_or(IntegrationError::NotConfigured)?;
        let redirect_uri = Self::redirect_uri(config, provider);
        let client = oauth::build_client(provider, &oauth_cfg, &redirect_uri)?;

        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
        let mut request = client
            .authorize_url(CsrfToken::new_random)
            .add_scope(Scope::new(oauth::scope_for(provider).to_string()))
            .set_pkce_challenge(pkce_challenge);
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
        let client = oauth::build_client(provider, &oauth_cfg, &oauth_state.redirect_uri)?;

        let token = client
            .exchange_code(AuthorizationCode::new(code.to_string()))
            .set_pkce_verifier(PkceCodeVerifier::new(oauth_state.pkce_verifier))
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
        };
        let (external_account_id, external_account_name) = match account {
            Some((id, name)) => (Some(id), name),
            None => (None, None),
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
        let client = oauth::build_client(connection.provider, &oauth_cfg, &redirect_uri)?;

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
            .ok_or(IntegrationError::ConnectionNotFound)?;

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
        };

        Connection::mark_synced(pool, connection.id).await?;
        Ok(metrics)
    }
}
