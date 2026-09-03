mod audit;
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

    // Background report worker, embedded in the API process. It used to run
    // only as a separate `reporta-worker` binary/container which was easy to
    // forget in dev — when it wasn't running, queued reports sat in
    // "Queued" forever and the UI never progressed. Running it here means a
    // plain `cargo run` / `./dev.sh` always drains the job queue.
    {
        use reporta_insights::{InsightsEngine, OpenAIClient};
        use reporta_reports::{run_worker_loop, ReportGenerationService};

        let llm = OpenAIClient::new(
            config.openai_api_key.clone().unwrap_or_default(),
            config.openai_model.clone(),
            config.openai_base_url.clone(),
        );
        let worker_config = config.clone();
        let worker_pool = state.pool.clone();
        let worker_cipher = TokenCipher::from_base64_key(&config.token_encryption_key_b64)
            .expect("invalid TOKEN_ENCRYPTION_KEY");
        let service = ReportGenerationService::new(
            ConnectionService::new(),
            InsightsEngine::new(llm),
            config.upload_dir.clone(),
        );
        let worker_id = format!("in-process-{}", uuid::Uuid::new_v4());
        tokio::spawn(async move {
            tracing::info!("in-process report worker starting: {worker_id}");
            run_worker_loop(worker_pool, worker_config, worker_cipher, service, worker_id).await;
        });
    }

    // CORS must echo the exact frontend origin and allow credentials so the
    // HttpOnly refresh cookie can be set and sent on cross-origin requests
    // from the Vite dev server (localhost:5173 -> localhost:8080). A
    // wildcard `*` origin is invalid for credentialed requests per the CORS
    // spec, so the old permissive layer silently broke session refresh.
    let mut allowed_origins = vec![config
        .frontend_base_url
        .parse::<HeaderValue>()
        .expect("FRONTEND_BASE_URL must be a valid origin")];
    if !config.is_production() {
        for dev_origin in ["http://localhost:5173", "http://127.0.0.1:5173"] {
            allowed_origins.push(dev_origin.parse::<HeaderValue>().expect("valid dev origin"));
        }
    }

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
        // With `allow_credentials(true)` the header list must be explicit —
        // combining credentials with the `Any` wildcard makes tower-http
        // panic at startup (and is invalid per the CORS spec).
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
        ])
        .allow_credentials(true);

    let app = routes::build_router(state.clone())
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!(addr, "reporta-api listening");
    let listener = tokio::net::TcpListener::bind(&addr).await.expect("failed to bind port");
    // `with_connect_info` makes the peer socket address available to the
    // `ClientIp` extractor so audit rows record where requests came from.
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await
    .expect("server error");
    Ok(())
}
