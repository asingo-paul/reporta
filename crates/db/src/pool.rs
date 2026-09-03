use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::PgPool;
use std::str::FromStr;
use std::time::Duration;

/// Creates a bounded connection pool. Pool size and timeouts are deliberately
/// conservative defaults suitable for a single small API instance; tune via
/// env if this ever needs to scale beyond a handful of instances.
pub async fn init_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let opts = PgConnectOptions::from_str(database_url)?;
    PgPoolOptions::new()
        .max_connections(20)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(300))
        .connect_with(opts)
        .await
}

/// Runs pending migrations from the workspace-root `migrations/` directory.
/// Safe to call on every startup: sqlx tracks applied versions and no-ops
/// once caught up.
pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("../../migrations").run(pool).await
}
