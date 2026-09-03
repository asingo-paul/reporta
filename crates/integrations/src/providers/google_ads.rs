use std::collections::HashMap;

use chrono::NaiveDate;
use reporta_common::metrics::RawMetrics;
use reporta_common::{format_change, BreakdownSection};
use serde::Deserialize;

use crate::error::IntegrationError;

/// Google has sunset v17–v21 — those paths now serve an HTML 404 page. The
/// live versions are v22 and v23. We try the newest first and fall back, so
/// the integration keeps working when Google ships a new version and later
/// retires the previous one (exactly what happened to v18 here).
const API_VERSIONS: &[&str] = &["v23", "v22"];

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
    let mut last_404: Option<IntegrationError> = None;
    for version in API_VERSIONS {
        let resp = http
            .get(format!(
                "https://googleads.googleapis.com/{version}/customers:listAccessibleCustomers"
            ))
            .bearer_auth(access_token)
            .header("developer-token", developer_token)
            .send()
            .await?;

        // A 404 (usually an HTML page, not JSON) means this version was
        // retired by Google — try the next one instead of failing the flow.
        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            let body = resp.text().await.unwrap_or_default();
            last_404 = Some(IntegrationError::Upstream {
                provider: "google_ads",
                message: body,
            });
            continue;
        }

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(IntegrationError::Upstream {
                provider: "google_ads",
                message: body,
            });
        }

        let parsed: ListAccessibleCustomersResponse = resp.json().await?;
        return Ok(parsed.resource_names.into_iter().next().map(|rn| {
            let id = rn.trim_start_matches("customers/").to_string();
            (id, None)
        }));
    }

    Err(last_404.unwrap_or(IntegrationError::Upstream {
        provider: "google_ads",
        message: "no supported Google Ads API version is currently reachable".to_string(),
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
    campaign: Option<GaqlCampaign>,
}

#[derive(Deserialize, Default)]
struct GaqlCampaign {
    #[serde(default)]
    name: Option<String>,
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

    let mut last_404: Option<IntegrationError> = None;
    for version in API_VERSIONS {
        let resp = http
            .post(format!(
                "https://googleads.googleapis.com/{version}/customers/{customer_id}/googleAds:searchStream"
            ))
            .bearer_auth(access_token)
            .header("developer-token", developer_token)
            .json(&serde_json::json!({ "query": query }))
            .send()
            .await?;

        // Retired version — fall through to the next supported one.
        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            let body = resp.text().await.unwrap_or_default();
            last_404 = Some(IntegrationError::Upstream {
                provider: "google_ads",
                message: body,
            });
            continue;
        }

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

        return Ok(totals);
    }

    Err(last_404.unwrap_or(IntegrationError::Upstream {
        provider: "google_ads",
        message: "no supported Google Ads API version is currently reachable".to_string(),
    }))
}

/// Spend/conversions by campaign, this period vs previous. Best-effort — any
/// failure returns an empty list rather than propagating.
pub async fn fetch_breakdowns(
    http: &reqwest::Client,
    access_token: &str,
    developer_token: &str,
    customer_id: &str,
    cur_start: NaiveDate,
    cur_end: NaiveDate,
    prev_start: NaiveDate,
    prev_end: NaiveDate,
) -> Vec<BreakdownSection> {
    async fn by_campaign(
        http: &reqwest::Client,
        token: &str,
        dev_token: &str,
        customer_id: &str,
        start: NaiveDate,
        end: NaiveDate,
    ) -> HashMap<String, (f64, f64, f64)> {
        let query = format!(
            "SELECT campaign.name, metrics.cost_micros, metrics.conversions, metrics.conversions_value \
             FROM campaign WHERE segments.date BETWEEN '{}' AND '{}'",
            start.format("%Y-%m-%d"),
            end.format("%Y-%m-%d"),
        );
        let mut out: HashMap<String, (f64, f64, f64)> = HashMap::new();
        for version in API_VERSIONS {
            let Ok(resp) = http
                .post(format!(
                    "https://googleads.googleapis.com/{version}/customers/{customer_id}/googleAds:searchStream"
                ))
                .bearer_auth(token)
                .header("developer-token", dev_token)
                .json(&serde_json::json!({ "query": query }))
                .send()
                .await
            else {
                return out;
            };
            if resp.status() == reqwest::StatusCode::NOT_FOUND {
                continue;
            }
            if !resp.status().is_success() {
                return out;
            }
            if let Ok(chunks) = resp.json::<Vec<SearchStreamChunk>>().await {
                for chunk in chunks {
                    for row in chunk.results {
                        let name = row
                            .campaign
                            .and_then(|c| c.name)
                            .unwrap_or_else(|| "(unnamed)".to_string());
                        let m = row.metrics.unwrap_or_default();
                        let e = out.entry(name).or_insert((0.0, 0.0, 0.0));
                        e.0 += m.cost_micros.and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) / 1_000_000.0;
                        e.1 += m.conversions.unwrap_or(0.0);
                        e.2 += m.conversions_value.unwrap_or(0.0);
                    }
                }
            }
            return out;
        }
        out
    }

    let cur = by_campaign(http, access_token, developer_token, customer_id, cur_start, cur_end).await;
    if cur.is_empty() {
        return Vec::new();
    }
    let prev = by_campaign(http, access_token, developer_token, customer_id, prev_start, prev_end).await;

    let mut ordered: Vec<(&String, &(f64, f64, f64))> = cur.iter().collect();
    ordered.sort_by(|a, b| b.1 .0.partial_cmp(&a.1 .0).unwrap_or(std::cmp::Ordering::Equal));

    let mut sec = BreakdownSection::new(
        "Google Ads spend by campaign (this period vs previous)",
        vec!["Campaign", "Spend", "Change", "Conversions", "Conv. value"],
    );
    for (name, (spend, conv, val)) in ordered.into_iter().take(8) {
        sec.push_row(vec![
            name.clone(),
            format!("${spend:.2}"),
            format_change(*spend, prev.get(name).map(|p| p.0).unwrap_or(0.0)),
            format!("{conv:.0}"),
            format!("${val:.2}"),
        ]);
    }
    if sec.is_empty() { Vec::new() } else { vec![sec] }
}
