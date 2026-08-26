use axum::extract::{Path, Query, State};
use axum::response::Redirect;
use axum::Json;
use reporta_common::metrics::Provider;
use reporta_common::{AppError, AppResult};
use reporta_db::models::Client;
use serde::Deserialize;
use uuid::Uuid;

use crate::extractors::AuthUser;
use crate::state::AppState;

fn parse_provider(raw: &str) -> AppResult<Provider> {
    match raw {
        "meta" => Ok(Provider::Meta),
        "ga4" => Ok(Provider::Ga4),
        "google_ads" => Ok(Provider::GoogleAds),
        _ => Err(AppError::Validation(format!("unknown provider: {raw}"))),
    }
}

#[derive(Debug, Deserialize)]
pub struct AuthorizeQuery {
    client_id: Uuid,
}

/// Starts the OAuth connection wizard for one provider. The frontend calls
/// this (authenticated, via fetch) and then navigates the browser to the
/// returned URL — the actual OAuth redirect dance happens outside the SPA's
/// fetch/XHR sandbox.
pub async fn authorize(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(provider): Path<String>,
    Query(query): Query<AuthorizeQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let provider = parse_provider(&provider)?;
    Client::find_for_user(&state.pool, query.client_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let url = state
        .integrations
        .start_authorization(&state.pool, &state.config, user_id, query.client_id, provider)
        .await
        .map_err(|e| match e {
            reporta_integrations::IntegrationError::NotConfigured => AppError::Validation(
                "this integration is not configured on the server yet".to_string(),
            ),
            other => AppError::Internal(anyhow::anyhow!(other)),
        })?;

    Ok(Json(serde_json::json!({ "url": url })))
}

#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

/// The provider redirects the *browser* here directly (not a fetch call), so
/// this always responds with a redirect back into the frontend app rather
/// than JSON.
pub async fn callback(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Query(query): Query<CallbackQuery>,
) -> Redirect {
    let provider = provider.as_str();
    let fail = |reason: &str| Redirect::to(&format!(
        "{}/clients/callback?provider={provider}&error={}",
        state.config.frontend_base_url,
        urlencoding_lite(reason)
    ));

    if let Some(err) = query.error {
        return fail(&err);
    }
    let (Some(code), Some(oauth_state)) = (query.code, query.state) else {
        return fail("missing_code_or_state");
    };

    match state
        .integrations
        .handle_callback(&state.pool, &state.config, &state.cipher, &oauth_state, &code)
        .await
    {
        Ok(connection) => Redirect::to(&format!(
            "{}/clients/{}/connections?connected={provider}",
            state.config.frontend_base_url, connection.client_id
        )),
        Err(e) => {
            tracing::warn!(?e, provider, "OAuth callback failed");
            fail("connection_failed")
        }
    }
}

/// Minimal, dependency-free percent-encoding for the handful of characters
/// that can appear in our own error-reason strings — not a general-purpose
/// URL encoder.
fn urlencoding_lite(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' || c == '-' { c.to_string() } else { "_".to_string() })
        .collect()
}
