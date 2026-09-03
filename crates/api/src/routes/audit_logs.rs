use axum::extract::{Query, State};
use axum::Json;
use reporta_common::AppResult;
use reporta_db::models::AuditLog;
use serde::Deserialize;

use crate::extractors::AuthUser;
use crate::state::AppState;

/// Page size bounds for the activity log: generous enough for a useful
/// screenful, tight enough that a caller can't ask for the whole table.
const DEFAULT_LIMIT: i64 = 50;
const MAX_LIMIT: i64 = 200;

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

/// The agency's confirmation log: every recorded create/update/delete/send
/// action across their workspace, newest first. Read-only and scoped to the
/// authenticated user.
pub async fn list_audit_logs(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<Json<Vec<AuditLog>>> {
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let offset = query.offset.unwrap_or(0).max(0);
    Ok(Json(AuditLog::list_for_user(&state.pool, user_id, limit, offset).await?))
}
