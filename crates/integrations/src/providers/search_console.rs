use chrono::NaiveDate;
use reporta_common::metrics::RawMetrics;
use serde::Deserialize;

use crate::error::IntegrationError;

#[derive(Deserialize)]
struct SitesResponse {
    #[serde(rename = "siteEntry", default)]
    site_entry: Vec<SiteEntry>,
}

#[derive(Deserialize)]
struct SiteEntry {
    #[serde(rename = "siteUrl")]
    site_url: String,
    #[serde(rename = "permissionLevel", default)]
    permission_level: String,
}

/// Returns the first verified site the token can see, preferring a fully
/// verified owner/user over an unverified one. Same one-click simplification
/// as the other providers' account pickers.
pub async fn fetch_primary_site(
    http: &reqwest::Client,
    access_token: &str,
) -> Result<Option<(String, Option<String>)>, IntegrationError> {
    let resp = http
        .get("https://www.googleapis.com/webmasters/v3/sites")
        .bearer_auth(access_token)
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream { provider: "search_console", message: body });
    }

    let parsed: SitesResponse = resp.json().await?;
    let mut sites = parsed.site_entry;
    sites.sort_by_key(|s| s.permission_level != "siteOwner" && s.permission_level != "siteFullUser");
    Ok(sites.into_iter().next().map(|s| (s.site_url.clone(), Some(s.site_url))))
}

#[derive(Deserialize, Default)]
struct SearchAnalyticsResponse {
    #[serde(default)]
    rows: Vec<SearchAnalyticsRow>,
}

#[derive(Deserialize)]
struct SearchAnalyticsRow {
    #[serde(default)]
    clicks: f64,
    #[serde(default)]
    impressions: f64,
    #[serde(default)]
    position: f64,
}

/// Pulls aggregated organic clicks/impressions/average position for a site
/// over a date range via the Search Analytics API. Search Console has no
/// concept of ad spend, revenue, or key events, so those fields stay zero.
pub async fn fetch_metrics(
    http: &reqwest::Client,
    access_token: &str,
    site_url: &str,
    period_start: NaiveDate,
    period_end: NaiveDate,
) -> Result<RawMetrics, IntegrationError> {
    let encoded_site = url::form_urlencoded::byte_serialize(site_url.as_bytes()).collect::<String>();
    let url = format!("https://www.googleapis.com/webmasters/v3/sites/{encoded_site}/searchAnalytics/query");

    let body = serde_json::json!({
        "startDate": period_start.format("%Y-%m-%d").to_string(),
        "endDate": period_end.format("%Y-%m-%d").to_string(),
        "rowLimit": 1,
    });

    let resp = http.post(url).bearer_auth(access_token).json(&body).send().await?;
    if !resp.status().is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream { provider: "search_console", message });
    }

    let parsed: SearchAnalyticsResponse = resp.json().await?;
    let row = parsed.rows.into_iter().next();

    Ok(RawMetrics {
        organic_clicks: row.as_ref().map(|r| r.clicks.round() as i64).unwrap_or(0),
        organic_impressions: row.as_ref().map(|r| r.impressions.round() as i64).unwrap_or(0),
        search_position: row.map(|r| r.position).unwrap_or(0.0),
        ..RawMetrics::default()
    })
}
