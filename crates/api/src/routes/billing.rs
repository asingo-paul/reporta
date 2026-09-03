use axum::body::Bytes;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use reporta_common::{AppError, AppResult};
use reporta_db::models::{Subscription, User};

use crate::audit;
use crate::extractors::{AuthUser, ClientIp};
use crate::state::AppState;

pub async fn create_checkout_session(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
) -> AppResult<Json<serde_json::Value>> {
    let user = User::find_by_id(&state.pool, user_id).await?.ok_or(AppError::Unauthorized)?;
    let url = state
        .billing
        .create_checkout_session(&state.pool, &user)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    audit::record(
        &state.pool,
        Some(user_id),
        "billing.checkout_started",
        Some("user"),
        Some(user_id),
        serde_json::json!({}),
        ip.as_deref(),
    );
    Ok(Json(serde_json::json!({ "url": url })))
}

pub async fn create_portal_session(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
) -> AppResult<Json<serde_json::Value>> {
    let user = User::find_by_id(&state.pool, user_id).await?.ok_or(AppError::Unauthorized)?;
    let url = state
        .billing
        .create_portal_session(&state.pool, &user)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    audit::record(
        &state.pool,
        Some(user_id),
        "billing.portal_opened",
        Some("user"),
        Some(user_id),
        serde_json::json!({}),
        ip.as_deref(),
    );
    Ok(Json(serde_json::json!({ "url": url })))
}

/// What the subscription endpoint returns: the raw local row (from the last
/// Stripe webhook), plus a server-side verdict on whether the subscription is
/// *currently* valid — good standing AND inside the paid period — and the
/// exact paid window for display.
#[derive(Debug, serde::Serialize)]
pub struct SubscriptionView {
    /// `null` when this account has never had a subscription.
    subscription: Option<Subscription>,
    is_currently_valid: bool,
    current_period_start: Option<chrono::DateTime<chrono::Utc>>,
    current_period_end: Option<chrono::DateTime<chrono::Utc>>,
}

impl From<Option<Subscription>> for SubscriptionView {
    fn from(subscription: Option<Subscription>) -> Self {
        Self {
            is_currently_valid: subscription.as_ref().is_some_and(|s| s.is_currently_valid()),
            current_period_start: subscription.as_ref().and_then(|s| s.current_period_start),
            current_period_end: subscription.as_ref().and_then(|s| s.current_period_end),
            subscription,
        }
    }
}

pub async fn get_subscription(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<SubscriptionView>> {
    let subscription = Subscription::find_by_user_id(&state.pool, user_id).await?;
    Ok(Json(SubscriptionView::from(subscription)))
}

/// Actively reconciles the user's subscription with Stripe, right after a
/// completed checkout. This is the fast, deterministic path that makes a
/// finished payment show up immediately (instead of only when the async
/// webhook happens to land).
pub async fn sync_subscription(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
) -> AppResult<Json<SubscriptionView>> {
    let user = User::find_by_id(&state.pool, user_id).await?.ok_or(AppError::Unauthorized)?;
    let synced = state
        .billing
        .sync_subscription_from_stripe(&state.pool, &user)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let view = SubscriptionView::from(Subscription::find_by_user_id(&state.pool, user_id).await?);

    audit::record(
        &state.pool,
        Some(user_id),
        "billing.subscription_synced",
        Some("billing"),
        None,
        serde_json::json!({
            "stripe_subscription_id": synced.as_ref().and_then(|s| s.stripe_subscription_id.as_deref()),
            "status": synced.as_ref().map(|s| &s.status) ,
            "in_period": view.is_currently_valid,
        }),
        ip.as_deref(),
    );
    Ok(Json(view))
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
