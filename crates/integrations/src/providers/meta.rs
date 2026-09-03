use std::collections::HashMap;

use chrono::NaiveDate;
use reporta_common::metrics::RawMetrics;
use reporta_common::{format_change, BreakdownSection};
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
    campaign_name: Option<String>,
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

fn purchase_sum(actions: Option<Vec<ActionValue>>) -> f64 {
    actions
        .unwrap_or_default()
        .into_iter()
        .filter(|a| a.action_type == "offsite_conversion.fb_pixel_purchase" || a.action_type == "purchase")
        .filter_map(|a| a.value.parse::<f64>().ok())
        .sum()
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

    Ok(RawMetrics {
        impressions: row.impressions.and_then(|v| v.parse().ok()).unwrap_or(0),
        clicks: row.clicks.and_then(|v| v.parse().ok()).unwrap_or(0),
        spend: row.spend.and_then(|v| v.parse().ok()).unwrap_or(0.0),
        conversions: purchase_sum(row.actions),
        revenue: purchase_sum(row.action_values),
        ..RawMetrics::default()
    })
}

/// Spend/conversions by campaign, this period vs previous — so the report can
/// say which campaigns moved the account. Best-effort.
pub async fn fetch_breakdowns(
    http: &reqwest::Client,
    access_token: &str,
    ad_account_id: &str,
    cur_start: NaiveDate,
    cur_end: NaiveDate,
    prev_start: NaiveDate,
    prev_end: NaiveDate,
) -> Vec<BreakdownSection> {
    async fn by_campaign(
        http: &reqwest::Client,
        token: &str,
        acct: &str,
        start: NaiveDate,
        end: NaiveDate,
    ) -> HashMap<String, (f64, f64, f64)> {
        let time_range =
            serde_json::json!({ "since": start.format("%Y-%m-%d").to_string(), "until": end.format("%Y-%m-%d").to_string() })
                .to_string();
        let url = format!("https://graph.facebook.com/{GRAPH_VERSION}/{acct}/insights");
        let resp = http
            .get(url)
            .query(&[
                ("fields", "campaign_name,spend,clicks,actions,action_values"),
                ("level", "campaign"),
                ("time_range", &time_range),
                ("limit", "50"),
                ("access_token", &token.to_string()),
            ])
            .send()
            .await;
        let mut out = HashMap::new();
        if let Ok(resp) = resp {
            if let Ok(parsed) = resp.json::<InsightsResponse>().await {
                for row in parsed.data {
                    let name = row.campaign_name.clone().unwrap_or_else(|| "(unnamed)".to_string());
                    let spend = row.spend.and_then(|v| v.parse().ok()).unwrap_or(0.0);
                    let conv = purchase_sum(row.actions);
                    let rev = purchase_sum(row.action_values);
                    out.insert(name, (spend, conv, rev));
                }
            }
        }
        out
    }

    let cur = by_campaign(http, access_token, ad_account_id, cur_start, cur_end).await;
    if cur.is_empty() {
        return Vec::new();
    }
    let prev = by_campaign(http, access_token, ad_account_id, prev_start, prev_end).await;

    let mut ordered: Vec<(&String, &(f64, f64, f64))> = cur.iter().collect();
    ordered.sort_by(|a, b| b.1 .0.partial_cmp(&a.1 .0).unwrap_or(std::cmp::Ordering::Equal));

    let mut sec = BreakdownSection::new(
        "Meta spend by campaign (this period vs previous)",
        vec!["Campaign", "Spend", "Change", "Conversions", "Revenue"],
    );
    for (name, (spend, conv, rev)) in ordered.into_iter().take(8) {
        let prev_spend = prev.get(name).map(|p| p.0).unwrap_or(0.0);
        sec.push_row(vec![
            name.clone(),
            format!("${spend:.2}"),
            format_change(*spend, prev_spend),
            format!("{conv:.0}"),
            format!("${rev:.2}"),
        ]);
    }
    if sec.is_empty() { Vec::new() } else { vec![sec] }
}
