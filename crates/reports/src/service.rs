use std::path::Path;

use chrono::{Datelike, Duration, NaiveDate};
use reporta_common::metrics::{
    available_metrics, format_metric_value, DerivedMetrics, MetricFamily, MetricKind, Provider,
    RawMetrics,
};
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
                // Full detail (which can be a large HTML body from a provider)
                // goes to the logs; the report row gets a short, safe sentence.
                tracing::error!(report_id = %report_id, error = %err, "report generation failed");
                Report::mark_failed(pool, report_id, &friendly_error(&err)).await.ok();
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
        // Pull every (connection × {current, previous period}) pair
        // CONCURRENTLY instead of serially — with several integrations
        // connected this cuts the data-pull stage to roughly the slowest
        // single provider call rather than the sum of all of them.
        let pulls: Vec<_> = connections
            .iter()
            .map(|connection| async move {
                let current = self
                    .integrations
                    .fetch_metrics(pool, config, cipher, connection, report.period_start, report.period_end)
                    .await?;
                let previous = self
                    .integrations
                    .fetch_metrics(pool, config, cipher, connection, previous_start, previous_end)
                    .await?;
                Ok::<(RawMetrics, RawMetrics), ReportError>((current, previous))
            })
            .collect();
        for (current, previous) in futures_util::future::try_join_all(pulls).await? {
            current_totals = current_totals + current;
            previous_totals = previous_totals + previous;
        }

        // Segment breakdowns (best-effort — never fail the report over these).
        let breakdown_pulls = connections.iter().map(|connection| {
            self.integrations.fetch_breakdowns(
                pool, config, cipher, connection,
                report.period_start, report.period_end, previous_start, previous_end,
            )
        });
        let breakdowns: Vec<reporta_common::BreakdownSection> =
            futures_util::future::join_all(breakdown_pulls).await.into_iter().flatten().collect();

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

        // Only offer metrics the connected providers can actually supply: a
        // GA4-only client gets website-traffic metrics, not zero-filled ad
        // metrics like CTR/CPC/ROAS.
        //
        // The template acts as a per-family filter: within a family the user has
        // configured, honour their toggles; for a family they've enabled nothing
        // in (e.g. an old ad-only template that predates traffic metrics), show
        // every available metric of that family rather than hiding it.
        let providers: Vec<Provider> = connections.iter().map(|c| c.provider).collect();
        let available = available_metrics(&providers);
        let template_metrics: Vec<MetricKind> = template
            .enabled_metrics
            .iter()
            .filter_map(|s| MetricKind::from_str_opt(s))
            .collect();
        let enabled: Vec<MetricKind> = [MetricFamily::Advertising, MetricFamily::Traffic]
            .into_iter()
            .flat_map(|family| {
                let fam_available: Vec<MetricKind> =
                    available.iter().copied().filter(|m| m.family() == family).collect();
                let fam_selected: Vec<MetricKind> = fam_available
                    .iter()
                    .copied()
                    .filter(|m| template_metrics.contains(m))
                    .collect();
                if fam_selected.is_empty() { fam_available } else { fam_selected }
            })
            .collect();

        let mut points: Vec<MetricPoint> = enabled
            .iter()
            .map(|&kind| MetricPoint {
                kind,
                current: current.value_of(kind),
                previous: previous.value_of(kind),
                delta_pct: current.delta_pct(&previous, kind),
            })
            .collect();
        // Lead with metrics that have data. Metrics that are zero in both
        // periods stay in the report (for completeness) but sink below the
        // headline tiles. Stable sort keeps the family ordering otherwise.
        points.sort_by_key(|p| p.current == 0.0 && p.previous == 0.0);

        // --- Backend Action 3: Insight Engine ---
        Report::set_status(pool, report_id, ReportStatus::Analyzing, Some("Analyzing trends...")).await?;
        let period_label = format_period_label(report.period_start, report.period_end);
        let summary = self
            .insights
            .generate_summary(&client.name, &period_label, &points, &breakdowns)
            .await;
        Report::set_ai_narrative(
            pool,
            report_id,
            &summary.summary,
            &serde_json::json!(summary.recommendations),
            &summary.conclusion,
            summary.used_fallback,
        )
        .await?;

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
                    None => "—".to_string(),
                },
                delta_pct: p.delta_pct,
            })
            .collect();

        // The exact table the PDF is built from, persisted so the in-app report
        // view renders identical numbers (one source of truth).
        let metrics_json = serde_json::json!(points
            .iter()
            .map(|p| serde_json::json!({
                "key": p.kind.as_str(),
                "label": p.kind.label(),
                "current": format_metric_value(p.kind, p.current),
                "previous": format_metric_value(p.kind, p.previous),
                "change": match p.delta_pct {
                    Some(pct) => format!("{pct:+.1}%"),
                    None => "—".to_string(),
                },
                "delta_pct": p.delta_pct,
            }))
            .collect::<Vec<_>>());
        Report::set_metrics_json(pool, report_id, &metrics_json).await?;
        Report::set_breakdowns_json(pool, report_id, &serde_json::json!(breakdowns)).await?;

        let logo_asset = client
            .logo_url
            .as_deref()
            .or(template.logo_url.as_deref())
            .and_then(|url| self.read_upload(url).map(|bytes| ("logo".to_string() + &extension_of(url), bytes)));

        // Chart count-style metrics that actually have data, and only those
        // within ~20x of the largest so one big bar doesn't flatten the rest
        // into invisible slivers (a shared y-axis stays readable). Metrics that
        // don't make the chart still appear in the full table.
        let mut candidates: Vec<(String, f64, f64)> = points
            .iter()
            .filter(|p| !p.kind.is_percentage() && !p.kind.is_duration())
            .filter(|p| p.current > 0.0 || p.previous > 0.0)
            .map(|p| (p.kind.label().to_string(), p.previous, p.current))
            .collect();
        candidates.sort_by(|a, b| b.2.max(b.1).partial_cmp(&a.2.max(a.1)).unwrap_or(std::cmp::Ordering::Equal));
        let chart_bars: Vec<(String, f64, f64)> = match candidates.first().map(|c| c.2.max(c.1)) {
            Some(max) if max > 0.0 => candidates
                .into_iter()
                .filter(|(_, prev, curr)| curr.max(*prev) * 20.0 >= max)
                .take(3)
                .collect(),
            _ => Vec::new(),
        };
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
            ai_summary: summary.summary.clone(),
            ai_recommendations: summary.recommendations.clone(),
            ai_conclusion: summary.conclusion.clone(),
            ai_summary_was_edited: false,
            ai_summary_is_fallback: summary.used_fallback,
            sources: {
                let mut s: Vec<String> = providers.iter().map(|p| provider_label(*p).to_string()).collect();
                s.dedup();
                s
            },
            metrics,
            breakdowns: breakdowns.clone(),
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

/// A short, client-safe explanation for the report's `error` field. Provider
/// errors often carry a full HTML page or a stack of API detail — never put
/// that in front of the user.
fn friendly_error(err: &ReportError) -> String {
    use reporta_integrations::IntegrationError;
    match err {
        ReportError::NoConnections => {
            "This client has no connected data sources. Connect Google Analytics, Meta or Google Ads and try again.".to_string()
        }
        ReportError::Integration(IntegrationError::Upstream { provider, .. }) => {
            format!(
                "{provider} rejected the request. The connected account may not have data for this period, or the connection needs to be re-authorized."
            )
        }
        ReportError::Integration(IntegrationError::RefreshFailed(_)) => {
            "A data source connection has expired. Reconnect the account and try again.".to_string()
        }
        ReportError::Integration(_) => {
            "Could not pull data from a connected source. Please try again shortly.".to_string()
        }
        ReportError::Pdf(_) => "The report data was collected but the PDF could not be built.".to_string(),
        _ => "Something went wrong while generating this report. Please try again.".to_string(),
    }
}

fn provider_label(p: Provider) -> &'static str {
    match p {
        Provider::Meta => "Meta Ads",
        Provider::Ga4 => "Google Analytics 4",
        Provider::GoogleAds => "Google Ads",
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
