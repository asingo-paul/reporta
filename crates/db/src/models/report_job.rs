use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "job_status", rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Succeeded,
    Failed,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ReportJob {
    pub id: Uuid,
    pub report_id: Uuid,
    pub status: JobStatus,
    pub attempts: i32,
    pub max_attempts: i32,
    pub run_after: DateTime<Utc>,
    pub locked_at: Option<DateTime<Utc>>,
    pub locked_by: Option<String>,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ReportJob {
    pub async fn enqueue(pool: &PgPool, report_id: Uuid) -> Result<ReportJob, sqlx::Error> {
        sqlx::query_as::<_, ReportJob>(
            r#"insert into report_jobs (report_id) values ($1)
               returning id, report_id, status, attempts, max_attempts, run_after,
                         locked_at, locked_by, last_error, created_at, updated_at"#,
        )
        .bind(report_id)
        .fetch_one(pool)
        .await
    }

    /// Claims the next runnable job for this worker using `FOR UPDATE SKIP
    /// LOCKED` so multiple worker processes can poll the same table
    /// concurrently without double-processing a job.
    pub async fn claim_next(
        pool: &PgPool,
        worker_id: &str,
    ) -> Result<Option<ReportJob>, sqlx::Error> {
        let mut tx = pool.begin().await?;
        let job = sqlx::query_as::<_, ReportJob>(
            r#"select id, report_id, status, attempts, max_attempts, run_after,
                      locked_at, locked_by, last_error, created_at, updated_at
               from report_jobs
               where status = 'queued' and run_after <= now()
               order by run_after asc
               for update skip locked
               limit 1"#,
        )
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(ref job) = job {
            sqlx::query(
                r#"update report_jobs set status = 'running', attempts = attempts + 1,
                          locked_at = now(), locked_by = $2, updated_at = now()
                   where id = $1"#,
            )
            .bind(job.id)
            .bind(worker_id)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(job)
    }

    pub async fn mark_succeeded(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            "update report_jobs set status = 'succeeded', updated_at = now() where id = $1",
        )
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Re-queues with exponential backoff if attempts remain, otherwise marks
    /// the job permanently failed.
    pub async fn mark_failed_or_retry(
        pool: &PgPool,
        id: Uuid,
        attempts: i32,
        max_attempts: i32,
        error: &str,
    ) -> Result<(), sqlx::Error> {
        if attempts < max_attempts {
            let backoff_secs = 30i64 * (1i64 << attempts.min(6));
            sqlx::query(
                r#"update report_jobs set status = 'queued', last_error = $2,
                          run_after = now() + make_interval(secs => $3), updated_at = now()
                   where id = $1"#,
            )
            .bind(id)
            .bind(error)
            .bind(backoff_secs as f64)
            .execute(pool)
            .await?;
        } else {
            sqlx::query(
                "update report_jobs set status = 'failed', last_error = $2, updated_at = now() where id = $1",
            )
            .bind(id)
            .bind(error)
            .execute(pool)
            .await?;
        }
        Ok(())
    }
}
