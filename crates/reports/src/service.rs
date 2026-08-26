use std::path::Path;

use chrono::{Datelike, Duration, NaiveDate};
use reporta_common::metrics::{format_metric_value, DerivedMetrics, MetricKind, RawMetrics};
use reporta_common::{Config, ReportStatus};
use reporta_crypto::TokenCipher;
use reporta_db::models::{Client, Connection, Report, ReportTemplate, User};
use reporta_insights::{InsightsEngine, MetricPoint};
use reporta_integrations::ConnectionService;
use reporta_pdf::{render_comparison_chart, render_report_pdf, MetricRow, ReportInput};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::ReportError;

pub struct ReportGenerationService {
    pub integrations: ConnectionService,
    pub insights: InsightsEngine,
    pub upload_dir: String,
}

impl ReportGenerationService {
    pub fn new(integrations: ConnectionService, insights: InsightsEngine, upload_dir: String) -> Self {
        Self {
            integrations,
            insights,
            upload_dir,
        }
    }

    /// Runs the full pipeline from the spec (Backend Actions 1-4): pull data
    /// from every connected source, normalize it into one unified model,
    /// generate the AI executive summary, and render the final PDF. Updates
    /// the report's status at each stage so the frontend's progress bar
    /// ("Pulling data... Analyzing trends... Building PDF...") reflects real
    /// progress rather than a fake timer.
    pub async fn generate(
        &self,
        pool: &PgPool,
        config: &Config,
        cipher: &TokenCipher,
        report_id: Uuid,
    ) -> Result<(), ReportError> {
        match self.generate_inner(pool, config, cipher, report_id).await {
            Ok(()) => Ok(()),
            Err(err) => {
                Report::mark_failed(pool, report_id, &err.to_string()).await.ok();
                Err(err)
            }
        }
    }

    async fn generate_inner(
        &self,
        pool: &PgPool,
        config: &Config,
        cipher: &TokenCipher,
        report_id: Uuid,
    ) -> Result<(), ReportError> {
        let report = Report::find_by_id(pool, report_id).await?.ok_or(ReportError::NotFound)?;
        let client = Client::find_by_id(pool, report.client_id)
            .await?
            .ok_or(ReportError::NotFound)?;
        let agency = User::find_by_id(pool, report.user_id).await?.ok_or(ReportError::NotFound)?;
        let template = ReportTemplate::get_or_create_default(pool, report.user_id).await?;

        let connections = Connection::list_for_client(pool, client.id).await?;
        if connections.is_empty() {
            return Err(ReportError::NoConnections);
        }

        // --- Backend Action 1: Data Pull ---
        Report::set_status(pool, report_id, ReportStatus::PullingData, Some("Pulling data...")).await?;

        let period_len = report.period_end.signed_duration_since(report.period_start);
        let previous_start = report.period_start - (period_len + Duration::days(1));
        let previous_end = report.period_start - Duration::days(1);

        let mut current_totals = RawMetrics::default();
        let mut previous_totals = RawMetrics::default();
        for connection in &connections {
            let current = self
                .integrations
                .fetch_metrics(pool, config, cipher, connection, report.period_start, report.period_end)
                .await?;
            let previous = self
                .integrations
                .fetch_metrics(pool, config, cipher, connection, previous_start, previous_end)
                .await?;
            current_totals = current_totals + current;
            previous_totals = previous_totals + previous;
        }

        Report::set_metrics(
            pool,
            report_id,
            &serde_json::to_value(current_totals).unwrap_or_default(),
            &serde_json::to_value(previous_totals).unwrap_or_default(),
        )
        .await?;

        // --- Backend Action 2: Normalization ---
        let current = DerivedMetrics::from(current_totals);
        let previous = DerivedMetrics::from(previous_totals);

        let enabled: Vec<MetricKind> = template
            .enabled_metrics
            .iter()
            .filter_map(|s| MetricKind::from_str_opt(s))
            .collect();
        let enabled = if enabled.is_empty() { MetricKind::ALL.to_vec() } else { enabled };

        let points: Vec<MetricPoint> = enabled
            .iter()
            .map(|&kind| MetricPoint {
                kind,
                current: current.value_of(kind),
                previous: previous.value_of(kind),
                delta_pct: current.delta_pct(&previous, kind),
            })
            .collect();

        // --- Backend Action 3: Insight Engine ---
        Report::set_status(pool, report_id, ReportStatus::Analyzing, Some("Analyzing trends...")).await?;
        let period_label = format_period_label(report.period_start, report.period_end);
        let summary = self.insights.generate_summary(&client.name, &period_label, &points).await;
        Report::set_ai_summary(pool, report_id, &summary.text).await?;

        // --- Backend Action 4: Rendering ---
        Report::set_status(pool, report_id, ReportStatus::Rendering, Some("Building PDF...")).await?;

        let metrics: Vec<MetricRow> = points
            .iter()
            .map(|p| MetricRow {
                label: p.kind.label().to_string(),
                current: format_metric_value(p.kind, p.current),
                previous: format_metric_value(p.kind, p.previous),
                change: match p.delta_pct {
                    Some(pct) => format!("{pct:+.1}%"),
                    None => "n/a".to_string(),
                },
            })
            .collect();

        let logo_asset = client
            .logo_url
            .as_deref()
            .or(template.logo_url.as_deref())
            .and_then(|url| self.read_upload(url).map(|bytes| ("logo".to_string() + &extension_of(url), bytes)));

        let chart_bars: Vec<(String, f64, f64)> = points
            .iter()
            .filter(|p| !p.kind.is_percentage())
            .take(3)
            .map(|p| (p.kind.label().to_string(), p.previous, p.current))
            .collect();
        let chart_asset = if chart_bars.is_empty() {
            None
        } else {
            Some((
                "chart.svg".to_string(),
                render_comparison_chart("This Period vs. Previous Period", &chart_bars)?,
            ))
        };

        let intro_blurb = if template.intro_blurb.trim().is_empty() {
            format!("Here is your performance report for {}.", client.name)
        } else {
            template.intro_blurb.replace("[Client Name]", &client.name)
        };

        let input = ReportInput {
            agency_name: agency.name.clone(),
            client_name: client.name.clone(),
            period_label,
            brand_primary_color: template.brand_primary_color.clone(),
            brand_secondary_color: template.brand_secondary_color.clone(),
            intro_blurb,
            ai_summary: summary.text.clone(),
            ai_summary_was_edited: false,
            metrics,
            logo_asset: logo_asset.as_ref().map(|(name, _)| name.clone()),
            chart_asset: chart_asset.as_ref().map(|(name, _)| name.clone()),
        };

        let pdf_bytes = render_report_pdf(&input, logo_asset, chart_asset)?;

        let reports_dir = Path::new(&self.upload_dir).join("reports");
        std::fs::create_dir_all(&reports_dir)?;
        let pdf_path = reports_dir.join(format!("{report_id}.pdf"));
        std::fs::write(&pdf_path, pdf_bytes)?;

        Report::mark_completed(pool, report_id, &pdf_path.to_string_lossy()).await?;
        Ok(())
    }

    /// Best-effort read of a previously uploaded file (logo) from local
    /// storage. A missing or unreadable logo should degrade the report, not
    /// fail it outright, so this returns `None` rather than an error.
    fn read_upload(&self, url_or_path: &str) -> Option<Vec<u8>> {
        let filename = url_or_path.rsplit('/').next().unwrap_or(url_or_path);
        let path = Path::new(&self.upload_dir).join(filename);
        std::fs::read(path).ok()
    }
}

fn extension_of(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{e}"))
        .unwrap_or_default()
}

fn format_period_label(start: NaiveDate, end: NaiveDate) -> String {
    fn fmt(d: NaiveDate) -> String {
        format!("{} {}, {}", d.format("%B"), d.day(), d.year())
    }
    format!("{} - {}", fmt(start), fmt(end))
}
