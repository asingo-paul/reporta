mod email;
mod extractors;
mod routes;
mod state;

use std::sync::Arc;

use axum::http::{HeaderValue, Method};
use reporta_auth::{JwtIssuer, RefreshTokenService};
use reporta_billing::BillingService;
use reporta_common::{init_tracing, Config};
use reporta_crypto::TokenCipher;
use reporta_integrations::ConnectionService;
use tower_governor::governor::GovernorConfigBuilder;
use tower_governor::GovernorLayer;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use email::Mailer;
use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    let config = Config::from_env().expect("invalid configuration; check your .env against .env.example");
    init_tracing(&config.app_env);

    let pool = reporta_db::init_pool(&config.database_url).await.expect("failed to connect to Postgres");
    reporta_db::run_migrations(&pool).await.expect("failed to run migrations");

    let cipher = TokenCipher::from_base64_key(&config.token_encryption_key_b64).expect("invalid TOKEN_ENCRYPTION_KEY");
    let jwt = JwtIssuer::new(config.jwt_secret.clone(), config.access_token_ttl_secs);
    let refresh_tokens = RefreshTokenService::new(config.refresh_token_ttl_secs);
    let integrations = ConnectionService::new();
    let mailer = Mailer::new(&config);

    let billing = BillingService::new(
        config.stripe_secret_key.clone().unwrap_or_default(),
        config.stripe_price_id.clone().unwrap_or_default(),
        config.frontend_base_url.clone(),
        config.stripe_webhook_secret.clone().unwrap_or_default(),
    );

    let state = AppState {
        pool,
        config: Arc::new(config.clone()),
        cipher: Arc::new(cipher),
        jwt: Arc::new(jwt),
        refresh_tokens: Arc::new(refresh_tokens),
        integrations: Arc::new(integrations),
        billing: Arc::new(billing),
        mailer: Arc::new(mailer),
    };

    // Rate limit auth endpoints specifically hard (brute-force/credential
    // stuffing target) — a burst of 5 with 1 refill every 2s per client IP.
    // NOTE: `PeerIpKeyExtractor` (the default) reads the socket's peer
    // address. Behind a reverse proxy, configure it to trust
    // `X-Forwarded-For` from that proxy only, or this limits by the proxy's
    // IP instead of the real client.
    let auth_governor = GovernorConfigBuilder::default()
        .per_second(2)
        .burst_size(5)
        .finish()
        .expect("valid governor config");
    let auth_rate_limit = GovernorLayer::new(auth_governor);

    let cors = if config.is_production() {
        CorsLayer::new()
            .allow_origin(
                config
                    .frontend_base_url
                    .parse::<HeaderValue>()
                    .expect("FRONTEND_BASE_URL must be a valid origin"),
            )
            .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
            .allow_headers(tower_http::cors::Any)
    } else {
        CorsLayer::permissive()
    };

    let app = routes::build_router(state.clone())
        .layer(auth_rate_limit)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!(addr, "reporta-api listening");
    let listener = tokio::net::TcpListener::bind(&addr).await.expect("failed to bind port");
    axum::serve(listener, app).await.expect("server error");
    Ok(())
}
