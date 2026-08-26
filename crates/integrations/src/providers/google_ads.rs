use chrono::NaiveDate;
use reporta_common::metrics::RawMetrics;
use serde::Deserialize;

use crate::error::IntegrationError;

const API_VERSION: &str = "v18";

#[derive(Deserialize)]
struct ListAccessibleCustomersResponse {
    #[serde(rename = "resourceNames", default)]
    resource_names: Vec<String>,
}

/// Returns the first accessible customer id (e.g. "customers/1234567890"),
/// same one-click simplification as the other providers' account pickers.
/// Requires a developer token, unlike the other two providers.
pub async fn fetch_primary_customer(
    http: &reqwest::Client,
    access_token: &str,
    developer_token: &str,
) -> Result<Option<(String, Option<String>)>, IntegrationError> {
    let resp = http
        .get(format!(
            "https://googleads.googleapis.com/{API_VERSION}/customers:listAccessibleCustomers"
        ))
        .bearer_auth(access_token)
        .header("developer-token", developer_token)
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream {
            provider: "google_ads",
            message: body,
        });
    }

    let parsed: ListAccessibleCustomersResponse = resp.json().await?;
    Ok(parsed.resource_names.into_iter().next().map(|rn| {
        let id = rn.trim_start_matches("customers/").to_string();
        (id, None)
    }))
}

#[derive(Deserialize)]
struct SearchStreamChunk {
    #[serde(default)]
    results: Vec<GaqlRow>,
}

#[derive(Deserialize, Default)]
struct GaqlRow {
    metrics: Option<GaqlMetrics>,
}

#[derive(Deserialize, Default)]
struct GaqlMetrics {
    #[serde(default, rename = "costMicros")]
    cost_micros: Option<String>,
    #[serde(default)]
    impressions: Option<String>,
    #[serde(default)]
    clicks: Option<String>,
    #[serde(default)]
    conversions: Option<f64>,
    #[serde(default, rename = "conversionsValue")]
    conversions_value: Option<f64>,
}

/// Pulls account-level spend/impressions/clicks/conversions/revenue for a
/// date range via a GAQL query against `searchStream`. `customer_id` is the
/// bare numeric id (no "customers/" prefix).
pub async fn fetch_metrics(
    http: &reqwest::Client,
    access_token: &str,
    developer_token: &str,
    customer_id: &str,
    period_start: NaiveDate,
    period_end: NaiveDate,
) -> Result<RawMetrics, IntegrationError> {
    let query = format!(
        "SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, \
         metrics.conversions, metrics.conversions_value \
         FROM customer \
         WHERE segments.date BETWEEN '{}' AND '{}'",
        period_start.format("%Y-%m-%d"),
        period_end.format("%Y-%m-%d"),
    );

    let resp = http
        .post(format!(
            "https://googleads.googleapis.com/{API_VERSION}/customers/{customer_id}/googleAds:searchStream"
        ))
        .bearer_auth(access_token)
        .header("developer-token", developer_token)
        .json(&serde_json::json!({ "query": query }))
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream {
            provider: "google_ads",
            message: body,
        });
    }

    let chunks: Vec<SearchStreamChunk> = resp.json().await?;

    let mut totals = RawMetrics::default();
    for chunk in chunks {
        for row in chunk.results {
            let Some(m) = row.metrics else { continue };
            totals.spend += m
                .cost_micros
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0)
                / 1_000_000.0;
            totals.impressions += m.impressions.and_then(|v| v.parse().ok()).unwrap_or(0);
            totals.clicks += m.clicks.and_then(|v| v.parse().ok()).unwrap_or(0);
            totals.conversions += m.conversions.unwrap_or(0.0);
            totals.revenue += m.conversions_value.unwrap_or(0.0);
        }
    }

    Ok(totals)
}
