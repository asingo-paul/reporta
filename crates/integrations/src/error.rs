#[derive(thiserror::Error, Debug)]
pub enum IntegrationError {
    #[error("provider is not configured on this server (missing client id/secret)")]
    NotConfigured,
    #[error("invalid or expired OAuth state")]
    InvalidState,
    #[error("OAuth code exchange failed: {0}")]
    ExchangeFailed(String),
    #[error("token refresh failed; the connection likely needs to be reconnected: {0}")]
    RefreshFailed(String),
    #[error("connection not found")]
    ConnectionNotFound,
    #[error("upstream API error ({provider}): {message}")]
    Upstream { provider: &'static str, message: String },
    #[error(transparent)]
    Crypto(#[from] reporta_crypto::CryptoError),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error(transparent)]
    Url(#[from] url::ParseError),
}
