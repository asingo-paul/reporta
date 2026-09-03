use std::env;

#[derive(thiserror::Error, Debug)]
pub enum ConfigError {
    #[error("missing required environment variable: {0}")]
    Missing(&'static str),
    #[error("invalid value for environment variable {0}: {1}")]
    Invalid(&'static str, String),
}

/// Strongly-typed application configuration loaded once at startup.
///
/// Every field here is either required (missing => the process refuses to
/// start) or has an explicit, safe default. Nothing is guessed or fabricated.
#[derive(Clone, Debug)]
pub struct Config {
    pub app_env: String,
    pub port: u16,
    pub app_base_url: String,
    pub frontend_base_url: String,

    pub database_url: String,
    pub redis_url: String,

    pub jwt_secret: String,
    pub access_token_ttl_secs: i64,
    pub refresh_token_ttl_secs: i64,
    /// 32-byte key, base64-encoded, used for AES-256-GCM encryption of OAuth tokens at rest.
    pub token_encryption_key_b64: String,

    pub openai_api_key: Option<String>,
    pub openai_model: String,
    /// Full endpoint URL implementing the OpenAI Chat Completions protocol.
    /// Defaults to OpenAI itself, but can point at any compatible provider
    /// (e.g. Google's Gemini compatibility endpoint or Groq) — useful for
    /// free-tier providers.
    pub openai_base_url: String,

    pub stripe_secret_key: Option<String>,
    pub stripe_webhook_secret: Option<String>,
    pub stripe_price_id: Option<String>,

    pub meta_app_id: Option<String>,
    pub meta_app_secret: Option<String>,

    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub google_ads_developer_token: Option<String>,

    pub smtp_host: Option<String>,
    pub smtp_port: u16,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub smtp_from: String,

    pub upload_dir: String,
    pub max_upload_bytes: usize,
}

fn required(key: &'static str) -> Result<String, ConfigError> {
    env::var(key)
        .ok()
        .filter(|v| !v.is_empty())
        .ok_or(ConfigError::Missing(key))
}

fn optional(key: &'static str) -> Option<String> {
    env::var(key).ok().filter(|v| !v.is_empty())
}

fn optional_parsed<T: std::str::FromStr>(key: &'static str, default: T) -> Result<T, ConfigError> {
    match optional(key) {
        None => Ok(default),
        Some(v) => v
            .parse::<T>()
            .map_err(|_| ConfigError::Invalid(key, v.clone())),
    }
}

impl Config {
    /// Loads configuration from process environment (populated from `.env` in
    /// dev via `dotenvy::dotenv()` before this is called). Required secrets
    /// that are missing cause an immediate error rather than a silent default,
    /// so misconfiguration is caught at boot, not mid-request.
    pub fn from_env() -> Result<Self, ConfigError> {
        let token_key = required("TOKEN_ENCRYPTION_KEY")?;
        use base64::Engine;
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(&token_key)
            .map_err(|_| {
                ConfigError::Invalid(
                    "TOKEN_ENCRYPTION_KEY",
                    "must be valid base64".to_string(),
                )
            })?;
        if decoded.len() != 32 {
            return Err(ConfigError::Invalid(
                "TOKEN_ENCRYPTION_KEY",
                "must decode to exactly 32 bytes (AES-256)".to_string(),
            ));
        }

        Ok(Self {
            app_env: optional("APP_ENV").unwrap_or_else(|| "development".to_string()),
            port: optional_parsed("PORT", 8080u16)?,
            app_base_url: required("APP_BASE_URL")?,
            frontend_base_url: required("FRONTEND_BASE_URL")?,

            database_url: required("DATABASE_URL")?,
            redis_url: required("REDIS_URL")?,

            jwt_secret: required("JWT_SECRET")?,
            // Long-lived sessions: 12h access tokens (silently refreshed by
            // the SPA via the refresh endpoint) and a 30-day *sliding* refresh
            // window — every refresh re-issues the refresh token for the full
            // 30 days, so an actively-used account stays signed in until it
            // explicitly logs out. Override via ACCESS_TOKEN_TTL_SECS /
            // REFRESH_TOKEN_TTL_SECS.
            access_token_ttl_secs: optional_parsed("ACCESS_TOKEN_TTL_SECS", 43_200i64)?,
            refresh_token_ttl_secs: optional_parsed("REFRESH_TOKEN_TTL_SECS", 2_592_000i64)?,
            token_encryption_key_b64: token_key,

            openai_api_key: optional("OPENAI_API_KEY"),
            // A short, mostly-templated 4-sentence summary doesn't need
            // frontier-tier reasoning; small cheap models keep per-report cost
            // proportionate to the product's $29/mo price point. Override via
            // OPENAI_MODEL for higher quality.
            openai_model: optional("OPENAI_MODEL")
                .unwrap_or_else(|| "gpt-4o-mini".to_string()),
            // Any OpenAI-compatible provider works. Defaults to OpenAI itself;
            // see .env.example for free-tier alternatives (Gemini, Groq).
            openai_base_url: optional("OPENAI_BASE_URL")
                .unwrap_or_else(|| "https://api.openai.com/v1/chat/completions".to_string()),

            stripe_secret_key: optional("STRIPE_SECRET_KEY"),
            stripe_webhook_secret: optional("STRIPE_WEBHOOK_SECRET"),
            stripe_price_id: optional("STRIPE_PRICE_ID"),

            meta_app_id: optional("META_APP_ID"),
            meta_app_secret: optional("META_APP_SECRET"),

            google_client_id: optional("GOOGLE_CLIENT_ID"),
            google_client_secret: optional("GOOGLE_CLIENT_SECRET"),
            google_ads_developer_token: optional("GOOGLE_ADS_DEVELOPER_TOKEN"),

            smtp_host: optional("SMTP_HOST"),
            smtp_port: optional_parsed("SMTP_PORT", 587u16)?,
            smtp_username: optional("SMTP_USERNAME"),
            smtp_password: optional("SMTP_PASSWORD"),
            smtp_from: optional("SMTP_FROM").unwrap_or_else(|| "reports@reporta.app".to_string()),

            upload_dir: optional("UPLOAD_DIR").unwrap_or_else(|| "/data/uploads".to_string()),
            max_upload_bytes: optional_parsed("MAX_UPLOAD_BYTES", 5 * 1024 * 1024usize)?,
        })
    }

    pub fn is_production(&self) -> bool {
        self.app_env == "production"
    }
}
