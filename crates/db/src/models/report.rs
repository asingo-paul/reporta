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
    /// The computed per-metric table `[{ key, label, current, previous, change,
    /// delta_pct }]` the PDF was rendered from. The frontend reads this so its
    /// numbers can never drift from the document's.
    pub metrics_json: Option<serde_json::Value>,
    /// Segment breakdown tables `[{ title, columns, rows }]` shown below the
    /// headline metrics in the report and the app.
    pub breakdowns_json: Option<serde_json::Value>,
    pub ai_summary: Option<String>,
    /// AI-generated actionable recommendations (`["...", "..."]`).
    pub ai_recommendations: Option<serde_json::Value>,
    /// AI-generated forward-looking conclusion.
    pub ai_conclusion: Option<String>,
    pub ai_summary_edited: bool,
    /// True when the AI narrative fell back to the deterministic template
    /// (LLM unconfigured, erroring, or failing the hallucination guard).
    pub ai_summary_is_fallback: bool,
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
                         progress_message, raw_metrics, previous_raw_metrics, metrics_json, breakdowns_json, ai_summary,
                         ai_recommendations, ai_conclusion, ai_summary_edited, ai_summary_is_fallback, pdf_path, error, sent_at, created_at, updated_at"#,
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
                      progress_message, raw_metrics, previous_raw_metrics, metrics_json, breakdowns_json, ai_summary,
                      ai_recommendations, ai_conclusion, ai_summary_edited, ai_summary_is_fallback, pdf_path, error, sent_at, created_at, updated_at
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
                      progress_message, raw_metrics, previous_raw_metrics, metrics_json, breakdowns_json, ai_summary,
                      ai_recommendations, ai_conclusion, ai_summary_edited, ai_summary_is_fallback, pdf_path, error, sent_at, created_at, updated_at
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
                      progress_message, raw_metrics, previous_raw_metrics, metrics_json, breakdowns_json, ai_summary,
                      ai_recommendations, ai_conclusion, ai_summary_edited, ai_summary_is_fallback, pdf_path, error, sent_at, created_at, updated_at
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

    pub async fn set_metrics_json(
        pool: &PgPool,
        id: Uuid,
        metrics_json: &serde_json::Value,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("update reports set metrics_json = $2, updated_at = now() where id = $1")
            .bind(id)
            .bind(metrics_json)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn set_breakdowns_json(
        pool: &PgPool,
        id: Uuid,
        breakdowns_json: &serde_json::Value,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("update reports set breakdowns_json = $2, updated_at = now() where id = $1")
            .bind(id)
            .bind(breakdowns_json)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn set_ai_narrative(
        pool: &PgPool,
        id: Uuid,
        ai_summary: &str,
        ai_recommendations: &serde_json::Value,
        ai_conclusion: &str,
        is_fallback: bool,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"update reports set ai_summary = $2, ai_recommendations = $3, ai_conclusion = $4,
                      ai_summary_is_fallback = $5, updated_at = now()
               where id = $1"#,
        )
        .bind(id)
        .bind(ai_summary)
        .bind(ai_recommendations)
        .bind(ai_conclusion)
        .bind(is_fallback)
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
                         progress_message, raw_metrics, previous_raw_metrics, metrics_json, breakdowns_json, ai_summary,
                         ai_recommendations, ai_conclusion, ai_summary_edited, ai_summary_is_fallback, pdf_path, error, sent_at, created_at, updated_at"#,
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

    /// User-driven delete, scoped to the owning user. Any queued/running
    /// `report_jobs` row goes with it via the schema's `on delete cascade`;
    /// the generated PDF on disk is cleaned up by the caller (best-effort).
    pub async fn delete_for_user(
        pool: &PgPool,
        id: Uuid,
        user_id: Uuid,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("delete from reports where id = $1 and user_id = $2")
            .bind(id)
            .bind(user_id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}
