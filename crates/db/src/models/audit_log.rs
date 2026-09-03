use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct AuditLog {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub action: String,
    pub target_type: Option<String>,
    pub target_id: Option<Uuid>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

impl AuditLog {
    /// Records a security/business-relevant action. Best-effort: a logging
    /// failure must never fail the request it's describing, so callers
    /// should log-and-ignore errors from this rather than propagate them.
    pub async fn record(
        pool: &PgPool,
        user_id: Option<Uuid>,
        action: &str,
        target_type: Option<&str>,
        target_id: Option<Uuid>,
        metadata: serde_json::Value,
        ip_address: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"insert into audit_logs (user_id, action, target_type, target_id, metadata, ip_address)
               values ($1, $2, $3, $4, $5, $6)"#,
        )
        .bind(user_id)
        .bind(action)
        .bind(target_type)
        .bind(target_id)
        .bind(metadata)
        .bind(ip_address)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Most recent audit entries for one user, newest first. Scoped to the
    /// whole account (all clients/reports the user touched) because the
    /// activity log answers "what happened in my workspace", not "what
    /// happened to one row". `limit` is clamped by the caller.
    pub async fn list_for_user(
        pool: &PgPool,
        user_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<AuditLog>, sqlx::Error> {
        sqlx::query_as::<_, AuditLog>(
            r#"select id, user_id, action, target_type, target_id, metadata, ip_address, created_at
               from audit_logs
               where user_id = $1
               order by created_at desc
               limit $2 offset $3"#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
    }
}
