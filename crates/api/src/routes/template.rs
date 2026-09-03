use axum::extract::{Multipart, State};
use axum::Json;
use reporta_common::metrics::MetricKind;
use reporta_common::{AppError, AppResult};
use reporta_db::models::ReportTemplate;
use serde::Deserialize;
use validator::Validate;

use crate::audit;
use crate::extractors::{AuthUser, ClientIp};
use crate::state::AppState;

pub async fn get_template(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<ReportTemplate>> {
    Ok(Json(ReportTemplate::get_or_create_default(&state.pool, user_id).await?))
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateTemplateRequest {
    brand_primary_color: String,
    brand_secondary_color: String,
    /// Machine-readable metric keys (see `MetricKind::as_str`), e.g.
    /// `["impressions", "spend", "roas"]` — the Template Builder's toggle
    /// switches for the 10 standard metrics.
    enabled_metrics: Vec<String>,
    #[validate(length(max = 2000))]
    intro_blurb: String,
}

pub async fn update_template(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
    Json(req): Json<UpdateTemplateRequest>,
) -> AppResult<Json<ReportTemplate>> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    crate::routes::validate_hex_color(&req.brand_primary_color)?;
    crate::routes::validate_hex_color(&req.brand_secondary_color)?;

    let enabled_metrics: Vec<String> = req
        .enabled_metrics
        .iter()
        .filter_map(|s| MetricKind::from_str_opt(s))
        .map(|m| m.as_str().to_string())
        .collect();
    if enabled_metrics.is_empty() {
        return Err(AppError::Validation("select at least one metric".to_string()));
    }

    let template = ReportTemplate::update(
        &state.pool,
        user_id,
        None,
        &req.brand_primary_color,
        &req.brand_secondary_color,
        &enabled_metrics,
        &req.intro_blurb,
    )
    .await?;

    audit::record(
        &state.pool,
        Some(user_id),
        "template.updated",
        Some("template"),
        Some(template.id),
        serde_json::json!({ "enabled_metrics": enabled_metrics }),
        ip.as_deref(),
    );
    Ok(Json(template))
}

/// Accepts a single-file multipart upload for the agency logo. Validated by
/// real magic-byte content sniffing (not the client-supplied filename or
/// declared content-type, both of which are trivially spoofable) and a hard
/// size cap, then written under a random filename so a client can never
/// control the on-disk path.
pub async fn upload_logo(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
    mut multipart: Multipart,
) -> AppResult<Json<ReportTemplate>> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Validation(e.to_string()))?
        .ok_or_else(|| AppError::Validation("no file provided".to_string()))?;

    let bytes = field.bytes().await.map_err(|e| AppError::Validation(e.to_string()))?;
    if bytes.len() > state.config.max_upload_bytes {
        return Err(AppError::Validation("logo file is too large".to_string()));
    }

    let kind = infer::get(&bytes).ok_or_else(|| AppError::Validation("unrecognized file type".to_string()))?;
    let extension = match kind.mime_type() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/svg+xml" => "svg",
        other => return Err(AppError::Validation(format!("unsupported logo file type: {other}"))),
    };

    std::fs::create_dir_all(&state.config.upload_dir).map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
    let filename = format!("{}.{extension}", uuid::Uuid::new_v4());
    let path = std::path::Path::new(&state.config.upload_dir).join(&filename);
    std::fs::write(&path, &bytes).map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let existing = ReportTemplate::get_or_create_default(&state.pool, user_id).await?;
    let template = ReportTemplate::update(
        &state.pool,
        user_id,
        Some(&filename),
        &existing.brand_primary_color,
        &existing.brand_secondary_color,
        &existing.enabled_metrics,
        &existing.intro_blurb,
    )
    .await?;

    audit::record(
        &state.pool,
        Some(user_id),
        "template.logo_uploaded",
        Some("template"),
        Some(template.id),
        serde_json::json!({ "filename": filename, "bytes": bytes.len() }),
        ip.as_deref(),
    );
    Ok(Json(template))
}
