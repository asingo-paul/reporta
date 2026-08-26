pub mod config;
pub mod error;
pub mod metrics;
pub mod report_status;

pub use config::Config;
pub use error::{AppError, AppResult};
pub use report_status::ReportStatus;

/// Initializes structured (JSON in production, pretty in dev) tracing output.
/// Call once at process start, before anything else logs.
pub fn init_tracing(app_env: &str) {
    use tracing_subscriber::{fmt, EnvFilter};

    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn"));

    if app_env == "production" {
        fmt().json().with_env_filter(filter).init();
    } else {
        fmt().pretty().with_env_filter(filter).init();
    }
}
