use std::collections::HashMap;

use chrono::NaiveDate;
use reporta_common::metrics::RawMetrics;
use reporta_common::{format_change, BreakdownSection};
use serde::Deserialize;

use crate::error::IntegrationError;

#[derive(Deserialize)]
struct AccountSummariesResponse {
    #[serde(rename = "accountSummaries", default)]
    account_summaries: Vec<AccountSummary>,
}

#[derive(Deserialize)]
struct AccountSummary {
    #[serde(rename = "propertySummaries", default)]
    property_summaries: Vec<PropertySummary>,
}

#[derive(Deserialize)]
struct PropertySummary {
    property: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
}

/// Returns the first GA4 property the token can see (`properties/12345`),
/// same one-click simplification as the Meta ad-account picker.
pub async fn fetch_primary_property(
    http: &reqwest::Client,
    access_token: &str,
) -> Result<Option<(String, Option<String>)>, IntegrationError> {
    let resp = http
        .get("https://analyticsadmin.googleapis.com/v1beta/accountSummaries")
        .bearer_auth(access_token)
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream {
            provider: "ga4",
            message: body,
        });
    }

    let parsed: AccountSummariesResponse = resp.json().await?;
    Ok(parsed
        .account_summaries
        .into_iter()
        .flat_map(|a| a.property_summaries)
        .next()
        .map(|p| (p.property, p.display_name)))
}

#[derive(Deserialize)]
struct RunReportResponse {
    #[serde(rename = "metricHeaders", default)]
    metric_headers: Vec<MetricHeader>,
    #[serde(default)]
    rows: Vec<ReportRow>,
}

#[derive(Deserialize)]
struct MetricHeader {
    name: String,
}

#[derive(Deserialize)]
struct ReportRow {
    #[serde(rename = "metricValues", default)]
    metric_values: Vec<MetricValue>,
}

#[derive(Deserialize)]
struct MetricValue {
    value: String,
}

/// The GA4 metrics requested for a website-traffic report. `keyEvents` is the
/// current name for what GA4 used to call `conversions`; older properties still
/// only accept `conversions`, so a 400 mentioning `keyEvents` triggers one
/// retry with the legacy name.
const TRAFFIC_METRICS: &[&str] = &[
    "sessions",
    "totalUsers",
    "newUsers",
    "screenPageViews",
    "engagedSessions",
    "userEngagementDuration",
    "keyEvents",
    "totalRevenue",
];

/// Pulls website-traffic metrics for the unified report. GA4 has no concept of
/// ad spend, clicks or impressions, so those fields stay zero from this
/// provider; sessions/users/pageviews/engagement plus key events and revenue
/// map into the traffic side of `RawMetrics`.
pub async fn fetch_metrics(
    http: &reqwest::Client,
    access_token: &str,
    property: &str,
    period_start: NaiveDate,
    period_end: NaiveDate,
) -> Result<RawMetrics, IntegrationError> {
    let by_name = match run_report(http, access_token, property, period_start, period_end, false).await {
        Ok(v) => v,
        // Retry once with the legacy `conversions` metric for properties that
        // predate the keyEvents rename.
        Err(IntegrationError::Upstream { message, .. }) if message.contains("keyEvents") => {
            run_report(http, access_token, property, period_start, period_end, true).await?
        }
        Err(e) => return Err(e),
    };

    let get = |name: &str| by_name.get(name).copied().unwrap_or(0.0);

    Ok(RawMetrics {
        impressions: 0,
        clicks: 0,
        spend: 0.0,
        conversions: get("keyEvents") + get("conversions"),
        revenue: get("totalRevenue"),
        sessions: get("sessions") as i64,
        total_users: get("totalUsers") as i64,
        new_users: get("newUsers") as i64,
        page_views: get("screenPageViews") as i64,
        engaged_sessions: get("engagedSessions") as i64,
        engagement_time_secs: get("userEngagementDuration"),
    })
}

/// One `runReport` call, returning a metric-name -> value map (parsed by the
/// response's `metricHeaders` so value order can never silently misalign).
async fn run_report(
    http: &reqwest::Client,
    access_token: &str,
    property: &str,
    period_start: NaiveDate,
    period_end: NaiveDate,
    legacy_conversions: bool,
) -> Result<std::collections::HashMap<String, f64>, IntegrationError> {
    let metrics: Vec<serde_json::Value> = TRAFFIC_METRICS
        .iter()
        .map(|m| if legacy_conversions && *m == "keyEvents" { "conversions" } else { m })
        .map(|m| serde_json::json!({ "name": m }))
        .collect();

    let body = serde_json::json!({
        "dateRanges": [{
            "startDate": period_start.format("%Y-%m-%d").to_string(),
            "endDate": period_end.format("%Y-%m-%d").to_string(),
        }],
        "metrics": metrics,
    });

    let url = format!("https://analyticsdata.googleapis.com/v1beta/{property}:runReport");
    let resp = http.post(url).bearer_auth(access_token).json(&body).send().await?;

    if !resp.status().is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream { provider: "ga4", message });
    }

    let parsed: RunReportResponse = resp.json().await?;
    let names: Vec<String> = parsed.metric_headers.into_iter().map(|h| h.name).collect();
    let mut out = HashMap::new();
    if let Some(row) = parsed.rows.into_iter().next() {
        for (i, mv) in row.metric_values.into_iter().enumerate() {
            if let Some(name) = names.get(i) {
                out.insert(name.clone(), mv.value.parse::<f64>().unwrap_or(0.0));
            }
        }
    }
    Ok(out)
}

#[derive(Deserialize)]
struct DimReportResponse {
    #[serde(rename = "dimensionHeaders", default)]
    dimension_headers: Vec<MetricHeader>,
    #[serde(rename = "metricHeaders", default)]
    metric_headers: Vec<MetricHeader>,
    #[serde(default)]
    rows: Vec<DimRow>,
}

#[derive(Deserialize)]
struct DimRow {
    #[serde(rename = "dimensionValues", default)]
    dimension_values: Vec<MetricValue>,
    #[serde(rename = "metricValues", default)]
    metric_values: Vec<MetricValue>,
}

/// One `runReport` broken down by a single dimension, ordered by the first
/// metric descending. Returns `(dimension label -> {metric name -> value})`.
async fn run_dim_report(
    http: &reqwest::Client,
    access_token: &str,
    property: &str,
    dimension: &str,
    metrics: &[&str],
    period_start: NaiveDate,
    period_end: NaiveDate,
    limit: i64,
) -> Result<Vec<(String, HashMap<String, f64>)>, IntegrationError> {
    let body = serde_json::json!({
        "dateRanges": [{
            "startDate": period_start.format("%Y-%m-%d").to_string(),
            "endDate": period_end.format("%Y-%m-%d").to_string(),
        }],
        "dimensions": [{ "name": dimension }],
        "metrics": metrics.iter().map(|m| serde_json::json!({ "name": m })).collect::<Vec<_>>(),
        "orderBys": [{ "metric": { "metricName": metrics[0] }, "desc": true }],
        "limit": limit,
    });

    let url = format!("https://analyticsdata.googleapis.com/v1beta/{property}:runReport");
    let resp = http.post(url).bearer_auth(access_token).json(&body).send().await?;
    if !resp.status().is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream { provider: "ga4", message });
    }

    let parsed: DimReportResponse = resp.json().await?;
    let mnames: Vec<String> = parsed.metric_headers.into_iter().map(|h| h.name).collect();
    let has_dim = !parsed.dimension_headers.is_empty();
    let mut out = Vec::new();
    for row in parsed.rows {
        let label = if has_dim {
            row.dimension_values.first().map(|v| v.value.clone()).unwrap_or_default()
        } else {
            String::new()
        };
        let mut vals = HashMap::new();
        for (i, mv) in row.metric_values.into_iter().enumerate() {
            if let Some(name) = mnames.get(i) {
                vals.insert(name.clone(), mv.value.parse::<f64>().unwrap_or(0.0));
            }
        }
        out.push((label, vals));
    }
    Ok(out)
}

/// Segment breakdowns that make the report's analysis specific to this
/// property: traffic by channel and by device (both periods), plus the current
/// period's top landing pages. Best-effort — a failed sub-query is skipped, not
/// fatal, since the headline metrics already succeeded.
pub async fn fetch_breakdowns(
    http: &reqwest::Client,
    access_token: &str,
    property: &str,
    cur_start: NaiveDate,
    cur_end: NaiveDate,
    prev_start: NaiveDate,
    prev_end: NaiveDate,
) -> Vec<BreakdownSection> {
    let mut sections = Vec::new();

    // --- Sessions by channel, this period vs previous ---
    let cur = run_dim_report(http, access_token, property, "sessionDefaultChannelGroup",
        &["sessions", "engagedSessions", "keyEvents"], cur_start, cur_end, 8).await;
    let prev = run_dim_report(http, access_token, property, "sessionDefaultChannelGroup",
        &["sessions"], prev_start, prev_end, 25).await;
    if let Ok(cur) = cur {
        let prev_map: HashMap<String, f64> = prev
            .unwrap_or_default()
            .into_iter()
            .map(|(k, v)| (k, v.get("sessions").copied().unwrap_or(0.0)))
            .collect();
        let mut sec = BreakdownSection::new(
            "Sessions by channel (this period vs previous)",
            vec!["Channel", "Sessions", "Change", "Engaged", "Key events"],
        );
        for (label, v) in cur.iter().take(6) {
            let sessions = v.get("sessions").copied().unwrap_or(0.0);
            let prev_sessions = prev_map.get(label).copied().unwrap_or(0.0);
            sec.push_row(vec![
                label.clone(),
                format!("{:.0}", sessions),
                format_change(sessions, prev_sessions),
                format!("{:.0}", v.get("engagedSessions").copied().unwrap_or(0.0)),
                format!("{:.0}", v.get("keyEvents").copied().unwrap_or(0.0)),
            ]);
        }
        if !sec.is_empty() {
            sections.push(sec);
        }
    }

    // --- Sessions by device, this period vs previous ---
    let cur = run_dim_report(http, access_token, property, "deviceCategory",
        &["sessions", "engagementRate"], cur_start, cur_end, 5).await;
    let prev = run_dim_report(http, access_token, property, "deviceCategory",
        &["sessions"], prev_start, prev_end, 5).await;
    if let Ok(cur) = cur {
        let prev_map: HashMap<String, f64> = prev
            .unwrap_or_default()
            .into_iter()
            .map(|(k, v)| (k, v.get("sessions").copied().unwrap_or(0.0)))
            .collect();
        let mut sec = BreakdownSection::new(
            "Sessions by device (this period vs previous)",
            vec!["Device", "Sessions", "Change", "Engagement rate"],
        );
        for (label, v) in cur.iter() {
            let sessions = v.get("sessions").copied().unwrap_or(0.0);
            sec.push_row(vec![
                label.clone(),
                format!("{:.0}", sessions),
                format_change(sessions, prev_map.get(label).copied().unwrap_or(0.0)),
                format!("{:.1}%", v.get("engagementRate").copied().unwrap_or(0.0) * 100.0),
            ]);
        }
        if !sec.is_empty() {
            sections.push(sec);
        }
    }

    // --- Top landing pages this period ---
    if let Ok(pages) = run_dim_report(http, access_token, property, "landingPagePlusQueryString",
        &["sessions", "engagementRate", "keyEvents"], cur_start, cur_end, 6).await
    {
        let mut sec = BreakdownSection::new(
            "Top landing pages (this period)",
            vec!["Landing page", "Sessions", "Engagement rate", "Key events"],
        );
        for (label, v) in pages.iter().take(6) {
            let page = if label.is_empty() { "(not set)".to_string() } else { label.clone() };
            sec.push_row(vec![
                page,
                format!("{:.0}", v.get("sessions").copied().unwrap_or(0.0)),
                format!("{:.1}%", v.get("engagementRate").copied().unwrap_or(0.0) * 100.0),
                format!("{:.0}", v.get("keyEvents").copied().unwrap_or(0.0)),
            ]);
        }
        if !sec.is_empty() {
            sections.push(sec);
        }
    }

    sections
}
