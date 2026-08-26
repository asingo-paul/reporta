use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct ReportTemplate {
    pub id: Uuid,
    pub user_id: Uuid,
    pub logo_url: Option<String>,
    pub brand_primary_color: String,
    pub brand_secondary_color: String,
    pub enabled_metrics: Vec<String>,
    pub intro_blurb: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ReportTemplate {
    pub async fn get_or_create_default(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<ReportTemplate, sqlx::Error> {
        if let Some(existing) = Self::find_for_user(pool, user_id).await? {
            return Ok(existing);
        }
        let default_metrics: Vec<String> = reporta_common::metrics::MetricKind::ALL
            .iter()
            .map(|m| m.as_str().to_string())
            .collect();
        sqlx::query_as::<_, ReportTemplate>(
            r#"insert into report_templates (user_id, enabled_metrics)
               values ($1, $2)
               on conflict (user_id) do update set user_id = excluded.user_id
               returning id, user_id, logo_url, brand_primary_color, brand_secondary_color,
                         enabled_metrics, intro_blurb, created_at, updated_at"#,
        )
        .bind(user_id)
        .bind(default_metrics)
        .fetch_one(pool)
        .await
    }

    pub async fn find_for_user(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Option<ReportTemplate>, sqlx::Error> {
        sqlx::query_as::<_, ReportTemplate>(
            r#"select id, user_id, logo_url, brand_primary_color, brand_secondary_color,
                      enabled_metrics, intro_blurb, created_at, updated_at
               from report_templates where user_id = $1"#,
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
    }

    pub async fn update(
        pool: &PgPool,
        user_id: Uuid,
        logo_url: Option<&str>,
        brand_primary_color: &str,
        brand_secondary_color: &str,
        enabled_metrics: &[String],
        intro_blurb: &str,
    ) -> Result<ReportTemplate, sqlx::Error> {
        sqlx::query_as::<_, ReportTemplate>(
            r#"
            insert into report_templates
                (user_id, logo_url, brand_primary_color, brand_secondary_color, enabled_metrics, intro_blurb)
            values ($1, $2, $3, $4, $5, $6)
            on conflict (user_id) do update set
                logo_url = coalesce(excluded.logo_url, report_templates.logo_url),
                brand_primary_color = excluded.brand_primary_color,
                brand_secondary_color = excluded.brand_secondary_color,
                enabled_metrics = excluded.enabled_metrics,
                intro_blurb = excluded.intro_blurb,
                updated_at = now()
            returning id, user_id, logo_url, brand_primary_color, brand_secondary_color,
                      enabled_metrics, intro_blurb, created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind(logo_url)
        .bind(brand_primary_color)
        .bind(brand_secondary_color)
        .bind(enabled_metrics)
        .bind(intro_blurb)
        .fetch_one(pool)
        .await
    }
}
