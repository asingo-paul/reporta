use axum::extract::{Path, Query, State};
use axum::response::Redirect;
use axum::Json;
use reporta_common::metrics::Provider;
use reporta_common::{AppError, AppResult};
use reporta_db::models::Client;
use serde::Deserialize;
use uuid::Uuid;

use crate::audit;
use crate::extractors::{AuthUser, ClientIp};
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
    ClientIp(ip): ClientIp,
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

    audit::record(
        &state.pool,
        Some(user_id),
        "integration.connect_started",
        Some("client"),
        Some(query.client_id),
        serde_json::json!({ "provider": provider }),
        ip.as_deref(),
    );
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
    ClientIp(ip): ClientIp,
    Path(provider): Path<String>,
    Query(query): Query<CallbackQuery>,
) -> Redirect {
    let provider = provider.as_str();
    let fail = |reason: &str| {
        // Failed connects are security-relevant (can indicate tampering with
        // the OAuth round-trip), so record them even without user context —
        // the provider + reason narrow down what happened.
        audit::record(
            &state.pool,
            None,
            "integration.connect_failed",
            None,
            None,
            serde_json::json!({ "provider": provider, "reason": reason }),
            ip.as_deref(),
        );
        Redirect::to(&format!(
            "{}/clients/callback?provider={provider}&error={}",
            state.config.frontend_base_url,
            url_encode(reason)
        ))
    };

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
            // Surface the *real* reason (e.g. Google's `error`/`error_description`
            // body) instead of a generic "connection failed" — the frontend maps
            // it to concrete, actionable next steps.
            fail(&oauth_error_reason(&e))
        }
    }
}

/// Minimal, dependency-free RFC 3986 percent-encoding for error-reason
/// strings that ride back to the frontend in a query parameter. Only
/// unreserved characters survive unencoded; everything else (spaces, '/',
/// '.', '"', etc.) is %-encoded so the reason round-trips losslessly.
fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Turns an upstream OAuth failure into a compact, actionable reason string.
///
/// The provider (especially Google) returns rich error bodies — e.g.
/// `{"error":"redirect_uri_mismatch","error_description":...}` — and the
/// frontend can turn each into a concrete "what to adjust" hint. Previously
/// every failure was collapsed into a generic `connection_failed`, which made
/// misconfigurations (redirect URI, app verification, client ids) undiagnosable.
fn oauth_error_reason(e: &reporta_integrations::IntegrationError) -> String {
    let raw = match e {
        reporta_integrations::IntegrationError::NotConfigured => "not_configured".to_string(),
        reporta_integrations::IntegrationError::InvalidState => "invalid_state".to_string(),
        reporta_integrations::IntegrationError::NoAccessibleAccount => {
            "no_accessible_account".to_string()
        }
        reporta_integrations::IntegrationError::Upstream { message, .. } => message.clone(),
        // ExchangeFailed / RefreshFailed carry the provider's actual error
        // payload (Google returns a JSON error body), which is exactly what
        // we want to surface.
        other => other.to_string(),
    };

    let mut raw = raw.trim().chars().take(300).collect::<String>();
    raw = raw.replace('\n', "; ").replace('\r', "");
    raw
}
