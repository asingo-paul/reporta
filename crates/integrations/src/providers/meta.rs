use chrono::NaiveDate;
use reporta_common::metrics::RawMetrics;
use serde::Deserialize;

use crate::error::IntegrationError;

const GRAPH_VERSION: &str = "v21.0";

/// Exchanges a short-lived user access token (from the standard OAuth code
/// exchange) for a long-lived one (~60 days), per Meta's non-standard
/// `fb_exchange_token` grant. Meta does not issue refresh tokens the way
/// GA4/Google Ads do — once this expires the user must reconnect.
pub async fn exchange_for_long_lived_token(
    http: &reqwest::Client,
    app_id: &str,
    app_secret: &str,
    short_lived_token: &str,
) -> Result<(String, Option<i64>), IntegrationError> {
    #[derive(Deserialize)]
    struct Resp {
        access_token: String,
        expires_in: Option<i64>,
    }

    let url = format!("https://graph.facebook.com/{GRAPH_VERSION}/oauth/access_token");
    let resp = http
        .get(url)
        .query(&[
            ("grant_type", "fb_exchange_token"),
            ("client_id", app_id),
            ("client_secret", app_secret),
            ("fb_exchange_token", short_lived_token),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream {
            provider: "meta",
            message: body,
        });
    }

    let parsed: Resp = resp.json().await?;
    Ok((parsed.access_token, parsed.expires_in))
}

#[derive(Deserialize)]
struct AdAccountsResponse {
    data: Vec<AdAccount>,
}

#[derive(Deserialize)]
struct AdAccount {
    id: String,
    name: Option<String>,
}

/// Returns the first ad account the token can access. Real products would
/// let the user pick from the full list; the MVP picks the first to keep the
/// connection wizard to a single click, matching the spec's "click to
/// connect" flow.
pub async fn fetch_primary_ad_account(
    http: &reqwest::Client,
    access_token: &str,
) -> Result<Option<(String, Option<String>)>, IntegrationError> {
    let url = format!("https://graph.facebook.com/{GRAPH_VERSION}/me/adaccounts");
    let resp = http
        .get(url)
        .query(&[("fields", "id,name"), ("access_token", access_token)])
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream {
            provider: "meta",
            message: body,
        });
    }

    let parsed: AdAccountsResponse = resp.json().await?;
    Ok(parsed.data.into_iter().next().map(|a| (a.id, a.name)))
}

#[derive(Deserialize)]
struct InsightsResponse {
    data: Vec<InsightRow>,
}

#[derive(Deserialize, Default)]
struct InsightRow {
    #[serde(default)]
    spend: Option<String>,
    #[serde(default)]
    impressions: Option<String>,
    #[serde(default)]
    clicks: Option<String>,
    #[serde(default)]
    actions: Option<Vec<ActionValue>>,
    #[serde(default)]
    action_values: Option<Vec<ActionValue>>,
}

#[derive(Deserialize)]
struct ActionValue {
    action_type: String,
    value: String,
}

/// Pulls aggregated spend/impressions/clicks/conversions/revenue for one ad
/// account over a date range via the Marketing API's Insights endpoint.
pub async fn fetch_metrics(
    http: &reqwest::Client,
    access_token: &str,
    ad_account_id: &str,
    period_start: NaiveDate,
    period_end: NaiveDate,
) -> Result<RawMetrics, IntegrationError> {
    let url = format!("https://graph.facebook.com/{GRAPH_VERSION}/{ad_account_id}/insights");
    let time_range = serde_json::json!({
        "since": period_start.format("%Y-%m-%d").to_string(),
        "until": period_end.format("%Y-%m-%d").to_string(),
    })
    .to_string();

    let resp = http
        .get(url)
        .query(&[
            ("fields", "spend,impressions,clicks,actions,action_values"),
            ("time_range", &time_range),
            ("access_token", &access_token.to_string()),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream {
            provider: "meta",
            message: body,
        });
    }

    let parsed: InsightsResponse = resp.json().await?;
    let row = parsed.data.into_iter().next().unwrap_or_default();

    let conversions = row
        .actions
        .unwrap_or_default()
        .into_iter()
        .filter(|a| a.action_type == "offsite_conversion.fb_pixel_purchase" || a.action_type == "purchase")
        .filter_map(|a| a.value.parse::<f64>().ok())
        .sum();

    let revenue = row
        .action_values
        .unwrap_or_default()
        .into_iter()
        .filter(|a| a.action_type == "offsite_conversion.fb_pixel_purchase" || a.action_type == "purchase")
        .filter_map(|a| a.value.parse::<f64>().ok())
        .sum();

    Ok(RawMetrics {
        impressions: row.impressions.and_then(|v| v.parse().ok()).unwrap_or(0),
        clicks: row.clicks.and_then(|v| v.parse().ok()).unwrap_or(0),
        spend: row.spend.and_then(|v| v.parse().ok()).unwrap_or(0.0),
        conversions,
        revenue,
    })
}
