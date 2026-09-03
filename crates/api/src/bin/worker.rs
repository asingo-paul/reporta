use reporta_common::{init_tracing, Config};
use reporta_crypto::TokenCipher;
use reporta_insights::{InsightsEngine, OpenAIClient};
use reporta_integrations::ConnectionService;
use reporta_reports::{run_worker_loop, ReportGenerationService};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    let config = Config::from_env().expect("invalid configuration; check your .env against .env.example");
    init_tracing(&config.app_env);

    let pool = reporta_db::init_pool(&config.database_url).await.expect("failed to connect to Postgres");
    reporta_db::run_migrations(&pool).await.expect("failed to run migrations");

    let cipher = TokenCipher::from_base64_key(&config.token_encryption_key_b64).expect("invalid TOKEN_ENCRYPTION_KEY");

    let llm = OpenAIClient::new(
        config.openai_api_key.clone().unwrap_or_default(),
        config.openai_model.clone(),
        config.openai_base_url.clone(),
    );
    let insights = InsightsEngine::new(llm);
    let service = ReportGenerationService::new(ConnectionService::new(), insights, config.upload_dir.clone());

    let worker_id = format!("worker-{}", uuid::Uuid::new_v4());
    run_worker_loop(pool, config, cipher, service, worker_id).await;
}
