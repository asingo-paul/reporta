use std::convert::Infallible;
use std::time::Duration;

use axum::extract::{Path, State};
use axum::response::sse::{Event as SseEvent, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::Json;
use chrono::Utc;
use reporta_common::{AppError, AppResult};
use reporta_db::models::{Client, Report, ReportJob, User};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::extractors::AuthUser;
use crate::state::AppState;

const REPORT_PERIOD_DAYS: i64 = 30;

/// Kicks off report generation: creates the `reports` row (status
/// `pending`) and enqueues a job for the worker to pick up. Returns
/// immediately — the frontend polls `GET /reports/:id/events` for the
/// "Pulling data... Analyzing trends... Building PDF..." progress bar.
pub async fn generate_report(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(client_id): Path<Uuid>,
) -> AppResult<Json<Report>> {
    Client::find_for_user(&state.pool, client_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let period_end = Utc::now().date_naive();
    let period_start = period_end - chrono::Duration::days(REPORT_PERIOD_DAYS - 1);

    let report = Report::create(&state.pool, client_id, user_id, period_start, period_end).await?;
    ReportJob::enqueue(&state.pool, report.id).await?;

    Ok(Json(report))
}

pub async fn list_reports(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(client_id): Path<Uuid>,
) -> AppResult<Json<Vec<Report>>> {
    Client::find_for_user(&state.pool, client_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(Report::list_for_client(&state.pool, client_id, user_id).await?))
}

pub async fn get_report(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(report_id): Path<Uuid>,
) -> AppResult<Json<Report>> {
    let report = Report::find_for_user(&state.pool, report_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(report))
}

/// Server-Sent Events stream of report status, polled from Postgres every
/// 1.5s until the job reaches a terminal state. SSE (rather than
/// WebSockets) because this is a one-way progress feed with no client
/// messages to send back — a plain GET that degrades gracefully and needs no
/// extra infrastructure.
pub async fn report_events(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(report_id): Path<Uuid>,
) -> AppResult<Sse<impl futures_core::Stream<Item = Result<SseEvent, Infallible>>>> {
    Report::find_for_user(&state.pool, report_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let pool = state.pool.clone();
    let stream = async_stream::stream! {
        loop {
            let report = match Report::find_for_user(&pool, report_id, user_id).await {
                Ok(Some(r)) => r,
                _ => break,
            };
            let payload = serde_json::json!({
                "status": report.status,
                "progress_message": report.progress_message,
                "error": report.error,
            });
            yield Ok(SseEvent::default().json_data(payload).unwrap_or_else(|_| SseEvent::default()));

            if report.status.is_terminal() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(1500)).await;
        }
    };

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateSummaryRequest {
    #[validate(length(min = 1, max = 4000))]
    ai_summary: String,
}

/// Lets the agency edit the AI-written summary before sending (spec Step D:
/// "They can edit the AI-written summary if they want").
pub async fn update_summary(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(report_id): Path<Uuid>,
    Json(req): Json<UpdateSummaryRequest>,
) -> AppResult<Json<Report>> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let report = Report::update_ai_summary_by_user(&state.pool, report_id, user_id, &req.ai_summary)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(report))
}

pub async fn download_pdf(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(report_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let report = Report::find_for_user(&state.pool, report_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    let path = report.pdf_path.ok_or_else(|| AppError::Validation("report is not ready yet".to_string()))?;
    let bytes = tokio::fs::read(&path).await.map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    Ok((
        [
            (axum::http::header::CONTENT_TYPE, "application/pdf".to_string()),
            (
                axum::http::header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"report-{report_id}.pdf\""),
            ),
        ],
        bytes,
    ))
}

#[derive(Debug, Deserialize, Validate)]
pub struct SendReportRequest {
    #[validate(email)]
    to_email: String,
    #[validate(length(min = 1, max = 200))]
    to_name: String,
}

pub async fn send_report(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(report_id): Path<Uuid>,
    Json(req): Json<SendReportRequest>,
) -> AppResult<Json<serde_json::Value>> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    let report = Report::find_for_user(&state.pool, report_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    let path = report.pdf_path.clone().ok_or_else(|| AppError::Validation("report is not ready yet".to_string()))?;
    let client = Client::find_for_user(&state.pool, report.client_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    let agency = User::find_by_id(&state.pool, user_id).await?.ok_or(AppError::Unauthorized)?;

    let bytes = tokio::fs::read(&path).await.map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    state
        .mailer
        .send_report(&req.to_email, &req.to_name, &agency.name, &client.name, bytes, &format!("{}-report.pdf", client.name))
        .await
        .map_err(|e| AppError::Validation(e.to_string()))?;

    Report::mark_sent(&state.pool, report_id).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
