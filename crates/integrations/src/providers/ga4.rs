use chrono::NaiveDate;
use reporta_common::metrics::RawMetrics;
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
    #[serde(default)]
    rows: Vec<ReportRow>,
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

/// Pulls website-traffic-side metrics for the unified report: GA4 has no
/// concept of ad spend or clicks, so those two fields are always zero from
/// this provider — `sessions` fills the "impressions" slot as the closest
/// available reach proxy, and `conversions`/`totalRevenue` map directly.
pub async fn fetch_metrics(
    http: &reqwest::Client,
    access_token: &str,
    property: &str,
    period_start: NaiveDate,
    period_end: NaiveDate,
) -> Result<RawMetrics, IntegrationError> {
    let body = serde_json::json!({
        "dateRanges": [{
            "startDate": period_start.format("%Y-%m-%d").to_string(),
            "endDate": period_end.format("%Y-%m-%d").to_string(),
        }],
        "metrics": [
            {"name": "sessions"},
            {"name": "conversions"},
            {"name": "totalRevenue"},
        ],
    });

    let url = format!("https://analyticsdata.googleapis.com/v1beta/{property}:runReport");
    let resp = http.post(url).bearer_auth(access_token).json(&body).send().await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream {
            provider: "ga4",
            message: body,
        });
    }

    let parsed: RunReportResponse = resp.json().await?;
    let row = parsed.rows.into_iter().next();
    let values: Vec<f64> = row
        .map(|r| {
            r.metric_values
                .into_iter()
                .filter_map(|m| m.value.parse::<f64>().ok())
                .collect()
        })
        .unwrap_or_default();

    let sessions = values.first().copied().unwrap_or(0.0);
    let conversions = values.get(1).copied().unwrap_or(0.0);
    let revenue = values.get(2).copied().unwrap_or(0.0);

    Ok(RawMetrics {
        impressions: sessions as i64,
        clicks: 0,
        spend: 0.0,
        conversions,
        revenue,
    })
}
