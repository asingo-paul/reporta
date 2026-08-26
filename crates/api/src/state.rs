use std::sync::Arc;

use reporta_auth::{JwtIssuer, RefreshTokenService};
use reporta_billing::BillingService;
use reporta_common::Config;
use reporta_crypto::TokenCipher;
use reporta_integrations::ConnectionService;
use sqlx::PgPool;

use crate::email::Mailer;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
    pub cipher: Arc<TokenCipher>,
    pub jwt: Arc<JwtIssuer>,
    pub refresh_tokens: Arc<RefreshTokenService>,
    pub integrations: Arc<ConnectionService>,
    pub billing: Arc<BillingService>,
    pub mailer: Arc<Mailer>,
}
