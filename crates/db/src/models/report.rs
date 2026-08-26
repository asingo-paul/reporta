use chrono::{DateTime, NaiveDate, Utc};
use reporta_common::ReportStatus;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct Report {
    pub id: Uuid,
    pub client_id: Uuid,
    pub user_id: Uuid,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub status: ReportStatus,
    pub progress_message: Option<String>,
    pub raw_metrics: Option<serde_json::Value>,
    pub previous_raw_metrics: Option<serde_json::Value>,
    pub ai_summary: Option<String>,
    pub ai_summary_edited: bool,
    pub pdf_path: Option<String>,
    pub error: Option<String>,
    pub sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Report {
    pub async fn create(
        pool: &PgPool,
        client_id: Uuid,
        user_id: Uuid,
        period_start: NaiveDate,
        period_end: NaiveDate,
    ) -> Result<Report, sqlx::Error> {
        sqlx::query_as::<_, Report>(
            r#"insert into reports (client_id, user_id, period_start, period_end)
               values ($1, $2, $3, $4)
               returning id, client_id, user_id, period_start, period_end, status,
                         progress_message, raw_metrics, previous_raw_metrics, ai_summary,
                         ai_summary_edited, pdf_path, error, sent_at, created_at, updated_at"#,
        )
        .bind(client_id)
        .bind(user_id)
        .bind(period_start)
        .bind(period_end)
        .fetch_one(pool)
        .await
    }

    /// Unscoped lookup for internal (worker) use — see the equivalent note
    /// on `Client::find_by_id`.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Report>, sqlx::Error> {
        sqlx::query_as::<_, Report>(
            r#"select id, client_id, user_id, period_start, period_end, status,
                      progress_message, raw_metrics, previous_raw_metrics, ai_summary,
                      ai_summary_edited, pdf_path, error, sent_at, created_at, updated_at
               from reports where id = $1"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn find_for_user(
        pool: &PgPool,
        id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<Report>, sqlx::Error> {
        sqlx::query_as::<_, Report>(
            r#"select id, client_id, user_id, period_start, period_end, status,
                      progress_message, raw_metrics, previous_raw_metrics, ai_summary,
                      ai_summary_edited, pdf_path, error, sent_at, created_at, updated_at
               from reports where id = $1 and user_id = $2"#,
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
    }

    pub async fn list_for_client(
        pool: &PgPool,
        client_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<Report>, sqlx::Error> {
        sqlx::query_as::<_, Report>(
            r#"select id, client_id, user_id, period_start, period_end, status,
                      progress_message, raw_metrics, previous_raw_metrics, ai_summary,
                      ai_summary_edited, pdf_path, error, sent_at, created_at, updated_at
               from reports where client_id = $1 and user_id = $2 order by created_at desc"#,
        )
        .bind(client_id)
        .bind(user_id)
        .fetch_all(pool)
        .await
    }

    pub async fn set_status(
        pool: &PgPool,
        id: Uuid,
        status: ReportStatus,
        progress_message: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "update reports set status = $2, progress_message = $3, updated_at = now() where id = $1",
        )
        .bind(id)
        .bind(status)
        .bind(progress_message)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn set_metrics(
        pool: &PgPool,
        id: Uuid,
        raw_metrics: &serde_json::Value,
        previous_raw_metrics: &serde_json::Value,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "update reports set raw_metrics = $2, previous_raw_metrics = $3, updated_at = now() where id = $1",
        )
        .bind(id)
        .bind(raw_metrics)
        .bind(previous_raw_metrics)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn set_ai_summary(
        pool: &PgPool,
        id: Uuid,
        ai_summary: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("update reports set ai_summary = $2, updated_at = now() where id = $1")
            .bind(id)
            .bind(ai_summary)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// User-driven edit of the AI summary (Step D in the spec: "they can edit
    /// the AI-written summary"). Flags `ai_summary_edited` for auditability.
    pub async fn update_ai_summary_by_user(
        pool: &PgPool,
        id: Uuid,
        user_id: Uuid,
        ai_summary: &str,
    ) -> Result<Option<Report>, sqlx::Error> {
        sqlx::query_as::<_, Report>(
            r#"update reports set ai_summary = $3, ai_summary_edited = true, updated_at = now()
               where id = $1 and user_id = $2
               returning id, client_id, user_id, period_start, period_end, status,
                         progress_message, raw_metrics, previous_raw_metrics, ai_summary,
                         ai_summary_edited, pdf_path, error, sent_at, created_at, updated_at"#,
        )
        .bind(id)
        .bind(user_id)
        .bind(ai_summary)
        .fetch_optional(pool)
        .await
    }

    pub async fn mark_completed(
        pool: &PgPool,
        id: Uuid,
        pdf_path: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"update reports set status = 'completed', pdf_path = $2,
                      progress_message = null, error = null, updated_at = now()
               where id = $1"#,
        )
        .bind(id)
        .bind(pdf_path)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn mark_failed(pool: &PgPool, id: Uuid, error: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            "update reports set status = 'failed', error = $2, updated_at = now() where id = $1",
        )
        .bind(id)
        .bind(error)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn mark_sent(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("update reports set sent_at = now(), updated_at = now() where id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
