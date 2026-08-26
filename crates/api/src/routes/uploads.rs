use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use reporta_common::{AppError, AppResult};
use reporta_db::models::ReportTemplate;

use crate::extractors::AuthUser;
use crate::state::AppState;

/// Serves an uploaded asset back to the browser — specifically the agency's
/// template logo, which is stored on disk under a random UUID filename in
/// `UPLOAD_DIR`.
///
/// Auth is required and access is scoped: a file is only served if its name
/// exactly matches the requesting user's own template `logo_url`, so no
/// caller can read arbitrary files just by guessing a filename (the names are
/// random, but we don't rely on that alone). Path traversal is rejected
/// outright.
pub async fn serve_upload(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(filename): Path<String>,
) -> AppResult<Response> {
    // Only a bare filename (no slashes, no `..`) is ever considered; this
    // keeps the on-disk path fully pinned inside UPLOAD_DIR.
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(AppError::NotFound);
    }

    let template = ReportTemplate::find_for_user(&state.pool, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Serve only this user's own current template logo.
    if template.logo_url.as_deref() != Some(&filename) {
        return Err(AppError::NotFound);
    }

    let path = std::path::Path::new(&state.config.upload_dir).join(&filename);
    let bytes = std::fs::read(&path).map_err(|_| AppError::NotFound)?;

    let content_type = match std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
    {
        Some("png") => "image/png",
        Some("jpg") => "image/jpeg",
        Some("jpeg") => "image/jpeg",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    };

    Ok((
        StatusCode::OK,
        [(axum::http::header::CONTENT_TYPE, content_type)],
        bytes,
    )
        .into_response())
}