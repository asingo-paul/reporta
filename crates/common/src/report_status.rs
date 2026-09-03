use serde::{Deserialize, Serialize};

/// Drives both the DB `report_status` enum and the SSE progress events the
/// frontend renders as "Pulling data... Analyzing trends... Building PDF...".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "report_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ReportStatus {
    Pending,
    PullingData,
    Analyzing,
    Rendering,
    Completed,
    Failed,
}

impl ReportStatus {
    pub fn progress_label(&self) -> &'static str {
        match self {
            ReportStatus::Pending => "Queued...",
            ReportStatus::PullingData => "Pulling data...",
            ReportStatus::Analyzing => "Analyzing trends...",
            ReportStatus::Rendering => "Building PDF...",
            ReportStatus::Completed => "Done",
            ReportStatus::Failed => "Failed",
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, ReportStatus::Completed | ReportStatus::Failed)
    }
}
