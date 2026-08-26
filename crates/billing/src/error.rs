#[derive(thiserror::Error, Debug)]
pub enum BillingError {
    #[error("Stripe is not configured on this server")]
    NotConfigured,
    #[error("Stripe API error: {0}")]
    Stripe(String),
    #[error("webhook signature verification failed: {0}")]
    InvalidWebhookSignature(String),
    #[error("Stripe did not return an expected field: {0}")]
    MissingField(&'static str),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

impl From<stripe::StripeError> for BillingError {
    fn from(err: stripe::StripeError) -> Self {
        BillingError::Stripe(err.to_string())
    }
}
