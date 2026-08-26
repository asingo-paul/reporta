use axum::body::Bytes;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use reporta_common::{AppError, AppResult};
use reporta_db::models::{Subscription, User};

use crate::extractors::AuthUser;
use crate::state::AppState;

pub async fn create_checkout_session(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    let user = User::find_by_id(&state.pool, user_id).await?.ok_or(AppError::Unauthorized)?;
    let url = state
        .billing
        .create_checkout_session(&state.pool, &user)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(serde_json::json!({ "url": url })))
}

pub async fn create_portal_session(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    let user = User::find_by_id(&state.pool, user_id).await?.ok_or(AppError::Unauthorized)?;
    let url = state
        .billing
        .create_portal_session(&state.pool, &user)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
    Ok(Json(serde_json::json!({ "url": url })))
}

pub async fn get_subscription(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<Option<Subscription>>> {
    Ok(Json(Subscription::find_by_user_id(&state.pool, user_id).await?))
}

/// Stripe webhook receiver. Takes the raw request body (not a parsed
/// `Json<T>`) because signature verification is computed over the exact
/// bytes Stripe sent — reserializing a parsed struct would not reproduce the
/// same signature and defeats the point of verifying it at all.
pub async fn webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> AppResult<Json<serde_json::Value>> {
    let signature = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::Validation("missing stripe-signature header".to_string()))?;
    let payload = std::str::from_utf8(&body).map_err(|_| AppError::Validation("invalid payload encoding".to_string()))?;

    let event = state
        .billing
        .verify_webhook(payload, signature)
        .map_err(|_| AppError::Unauthorized)?;

    state
        .billing
        .apply_event(&state.pool, event)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    Ok(Json(serde_json::json!({ "received": true })))
}
