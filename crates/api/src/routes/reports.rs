use std::convert::Infallible;
use std::time::Duration;

use axum::extract::{Path, State};
use axum::response::sse::{Event as SseEvent, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::Json;
use chrono::{NaiveDate, Utc};
use reporta_common::{AppError, AppResult};
use reporta_db::models::{Client, Report, ReportJob, User};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::audit;
use crate::extractors::{AuthUser, ClientIp};
use crate::state::AppState;

const REPORT_PERIOD_DAYS: i64 = 30;
/// Upper bound on a requested reporting window (guards against absurd ranges
/// that would hammer every connected provider for little value).
const MAX_REPORT_PERIOD_DAYS: i64 = 366;

#[derive(Debug, Deserialize)]
pub struct GenerateReportRequest {
    /// Optional `YYYY-MM-DD` range. When omitted, defaults to the trailing
    /// 30 days up to today (matching the legacy behavior).
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
}

fn resolve_period(
    req: Option<Json<GenerateReportRequest>>,
) -> AppResult<(NaiveDate, NaiveDate)> {
    let today = Utc::now().date_naive();

    if let Some(req) = req {
        if let Some(start_date) = req.start_date {
            let end_date = req.end_date.unwrap_or(today);

            if end_date > today {
                return Err(AppError::Validation("end_date cannot be in the future".to_string()));
            }
            if start_date > end_date {
                return Err(AppError::Validation("start_date must not be after end_date".to_string()));
            }
            if end_date.signed_duration_since(start_date).num_days() >= MAX_REPORT_PERIOD_DAYS {
                return Err(AppError::Validation(format!(
                    "report period cannot exceed {MAX_REPORT_PERIOD_DAYS} days"
                )));
            }
            return Ok((start_date, end_date));
        }
    }

    let period_end = today;
    let period_start = period_end - chrono::Duration::days(REPORT_PERIOD_DAYS - 1);
    Ok((period_start, period_end))
}

/// Kicks off report generation: creates the `reports` row (status
/// `pending`) and enqueues a job for the worker to pick up. Returns
/// immediately — the frontend polls `GET /reports/:id/events` for the
/// "Pulling data... Analyzing trends... Building PDF..." progress bar.
pub async fn generate_report(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
    Path(client_id): Path<Uuid>,
    body: Option<Json<GenerateReportRequest>>,
) -> AppResult<Json<Report>> {
    Client::find_for_user(&state.pool, client_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let (period_start, period_end) = resolve_period(body)?;

    let report = Report::create(&state.pool, client_id, user_id, period_start, period_end).await?;
    ReportJob::enqueue(&state.pool, report.id).await?;

    audit::record(
        &state.pool,
        Some(user_id),
        "report.generated",
        Some("report"),
        Some(report.id),
        serde_json::json!({
            "client_id": client_id,
            "period_start": period_start.to_string(),
            "period_end": period_end.to_string(),
        }),
        ip.as_deref(),
    );
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
    ClientIp(ip): ClientIp,
    Path(report_id): Path<Uuid>,
    Json(req): Json<UpdateSummaryRequest>,
) -> AppResult<Json<Report>> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let report = Report::update_ai_summary_by_user(&state.pool, report_id, user_id, &req.ai_summary)
        .await?
        .ok_or(AppError::NotFound)?;

    // The edited text itself stays out of the log — only the fact and size
    // of the edit are recorded, so the audit trail can't leak client copy.
    audit::record(
        &state.pool,
        Some(user_id),
        "report.summary_edited",
        Some("report"),
        Some(report.id),
        serde_json::json!({ "client_id": report.client_id, "length": req.ai_summary.len() }),
        ip.as_deref(),
    );
    Ok(Json(report))
}

/// Removes a report and (best-effort) its generated PDF from disk. The
/// `report_jobs` row cascades away via the schema, so a queued/running job
/// for a deleted report simply disappears.
pub async fn delete_report(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
    Path(report_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let report = Report::find_for_user(&state.pool, report_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let deleted = Report::delete_for_user(&state.pool, report_id, user_id).await?;
    if !deleted {
        return Err(AppError::NotFound);
    }

    // The file is only reachable through this report row, so remove it too —
    // but a stray file must never block the delete (it can be GC'd later).
    if let Some(pdf_path) = &report.pdf_path {
        if let Err(e) = tokio::fs::remove_file(pdf_path).await {
            if e.kind() != std::io::ErrorKind::NotFound {
                tracing::warn!(?e, report_id = %report_id, "failed to remove deleted report's PDF");
            }
        }
    }

    audit::record(
        &state.pool,
        Some(user_id),
        "report.deleted",
        Some("report"),
        Some(report_id),
        serde_json::json!({
            "client_id": report.client_id,
            "period_start": report.period_start.to_string(),
            "period_end": report.period_end.to_string(),
            "was_sent": report.sent_at.is_some(),
        }),
        ip.as_deref(),
    );
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn download_pdf(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
    Path(report_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let report = Report::find_for_user(&state.pool, report_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    let path = report.pdf_path.ok_or_else(|| AppError::Validation("report is not ready yet".to_string()))?;
    let bytes = tokio::fs::read(&path).await.map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    // Access log for sensitive exports: reports contain a client's ad data,
    // so every download is part of the confirmation trail.
    audit::record(
        &state.pool,
        Some(user_id),
        "report.pdf_downloaded",
        Some("report"),
        Some(report.id),
        serde_json::json!({ "client_id": report.client_id }),
        ip.as_deref(),
    );

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
    ClientIp(ip): ClientIp,
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

    // Deliveries are the highest-stakes report action (the client's data
    // leaves the workspace), so the log records exactly who received it.
    audit::record(
        &state.pool,
        Some(user_id),
        "report.sent",
        Some("report"),
        Some(report_id),
        serde_json::json!({
            "client_id": report.client_id,
            "to_email": req.to_email,
            "to_name": req.to_name,
        }),
        ip.as_deref(),
    );
    Ok(Json(serde_json::json!({ "ok": true })))
}
