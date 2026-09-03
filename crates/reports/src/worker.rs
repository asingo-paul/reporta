use std::time::Duration;

use reporta_common::Config;
use reporta_crypto::TokenCipher;
use reporta_db::models::ReportJob;
use sqlx::PgPool;

use crate::service::ReportGenerationService;

const POLL_INTERVAL_IDLE: Duration = Duration::from_secs(3);
const POLL_INTERVAL_ERROR: Duration = Duration::from_secs(5);

/// Runs forever, polling the Postgres-backed job queue with `FOR UPDATE SKIP
/// LOCKED` (see `ReportJob::claim_next`) so any number of worker processes
/// can run this same loop concurrently without double-processing a report.
pub async fn run_worker_loop(
    pool: PgPool,
    config: Config,
    cipher: TokenCipher,
    service: ReportGenerationService,
    worker_id: String,
) -> ! {
    tracing::info!(worker_id, "report worker started");
    loop {
        match ReportJob::claim_next(&pool, &worker_id).await {
            Ok(Some(job)) => {
                tracing::info!(job_id = %job.id, report_id = %job.report_id, "processing report job");
                match service.generate(&pool, &config, &cipher, job.report_id).await {
                    Ok(()) => {
                        if let Err(e) = ReportJob::mark_succeeded(&pool, job.id).await {
                            tracing::error!(?e, job_id = %job.id, "failed to mark job succeeded");
                        }
                    }
                    Err(err) => {
                        tracing::warn!(?err, job_id = %job.id, "report generation failed");
                        if let Err(e) =
                            ReportJob::mark_failed_or_retry(&pool, job.id, job.attempts, job.max_attempts, &err.to_string())
                                .await
                        {
                            tracing::error!(?e, job_id = %job.id, "failed to update failed job");
                        }
                    }
                }
            }
            Ok(None) => tokio::time::sleep(POLL_INTERVAL_IDLE).await,
            Err(e) => {
                tracing::error!(?e, "failed to claim next job");
                tokio::time::sleep(POLL_INTERVAL_ERROR).await;
            }
        }
    }
}
