//! Fire-and-forget audit trail helper.
//!
//! Every mutating endpoint records what happened (who, what, which row, from
//! which IP) into the `audit_logs` table, giving the agency a confirmation
//! log it can review in Settings → Activity. Recording is deliberately
//! best-effort, matching the contract documented on
//! `reporta_db::models::AuditLog::record`: an audit write must never fail the
//! request it is describing, and it must never add latency to it — so the
//! insert runs on a spawned task and failures are only logged.

use reporta_db::models::AuditLog;
use serde_json::Value;
use sqlx::PgPool;
use tracing::warn;
use uuid::Uuid;

/// Records an audit event without blocking or failing the caller.
#[allow(clippy::too_many_arguments)]
pub fn record(
    pool: &PgPool,
    user_id: Option<Uuid>,
    action: &str,
    target_type: Option<&str>,
    target_id: Option<Uuid>,
    metadata: Value,
    ip_address: Option<&str>,
) {
    let pool = pool.clone();
    let action = action.to_string();
    let target_type = target_type.map(str::to_string);
    let ip_address = ip_address.map(str::to_string);

    tokio::spawn(async move {
        if let Err(e) = AuditLog::record(
            &pool,
            user_id,
            &action,
            target_type.as_deref(),
            target_id,
            metadata,
            ip_address.as_deref(),
        )
        .await
        {
            warn!(error = ?e, action, "failed to write audit log");
        }
    });
}
