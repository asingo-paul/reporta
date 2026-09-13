//! LinkedIn Marketing API (REST, `/rest/*`). Field/endpoint names follow
//! LinkedIn's Ad Analytics documentation as of this writing — worth a quick
//! check against the live reference once real app credentials are in hand,
//! since this integration has not been exercised against a live account.
//! Unlike TikTok, LinkedIn's OAuth2 (authorize + token exchange) is fully
//! standard, so it goes through the shared `oauth2`-crate client in
//! `oauth.rs`/`connect.rs` — only the Marketing API calls below are bespoke.

use chrono::NaiveDate;
use reporta_common::metrics::RawMetrics;
use serde::Deserialize;

/// LinkedIn's versioned REST APIs require this header on every call — pinned
/// so a future LinkedIn API version bump doesn't silently change behavior.
const LINKEDIN_VERSION: &str = "202401";

use crate::error::IntegrationError;

#[derive(Deserialize)]
struct AdAccountsResponse {
    #[serde(default)]
    elements: Vec<AdAccount>,
}

#[derive(Deserialize)]
struct AdAccount {
    id: i64,
    #[serde(default)]
    name: Option<String>,
}

fn linkedin_headers(access_token: &str) -> Result<reqwest::header::HeaderMap, IntegrationError> {
    let bad_token = || IntegrationError::Upstream { provider: "linkedin", message: "access token is not a valid HTTP header value".to_string() };
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::AUTHORIZATION,
        format!("Bearer {access_token}").parse().map_err(|_| bad_token())?,
    );
    headers.insert("LinkedIn-Version", LINKEDIN_VERSION.parse().expect("static header value"));
    headers.insert("X-Restli-Protocol-Version", "2.0.0".parse().expect("static header value"));
    Ok(headers)
}

/// Returns the first active ad account the token can access, same one-click
/// simplification as the other providers' account pickers.
pub async fn fetch_primary_ad_account(
    http: &reqwest::Client,
    access_token: &str,
) -> Result<Option<(String, Option<String>)>, IntegrationError> {
    let resp = http
        .get("https://api.linkedin.com/rest/adAccounts?q=search&search=(status:(values:List(ACTIVE)))")
        .headers(linkedin_headers(access_token)?)
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream { provider: "linkedin", message: body });
    }

    let parsed: AdAccountsResponse = resp.json().await?;
    Ok(parsed.elements.into_iter().next().map(|a| (a.id.to_string(), a.name)))
}

#[derive(Deserialize)]
struct AnalyticsResponse {
    #[serde(default)]
    elements: Vec<AnalyticsRow>,
}

#[derive(Deserialize, Default)]
struct AnalyticsRow {
    #[serde(default)]
    impressions: Option<i64>,
    #[serde(default)]
    clicks: Option<i64>,
    #[serde(rename = "costInLocalCurrency", default)]
    cost_in_local_currency: Option<String>,
    #[serde(rename = "externalWebsiteConversions", default)]
    external_website_conversions: Option<f64>,
    #[serde(rename = "externalWebsiteConversionValue", default)]
    external_website_conversion_value: Option<f64>,
}

/// Pulls aggregated spend/impressions/clicks/conversions for one ad account
/// over a date range via the Ad Analytics API, account-level pivot.
pub async fn fetch_metrics(
    http: &reqwest::Client,
    access_token: &str,
    account_id: &str,
    period_start: NaiveDate,
    period_end: NaiveDate,
) -> Result<RawMetrics, IntegrationError> {
    let date_range = format!(
        "(start:(year:{},month:{},day:{}),end:(year:{},month:{},day:{}))",
        period_start.format("%Y"),
        period_start.format("%-m"),
        period_start.format("%-d"),
        period_end.format("%Y"),
        period_end.format("%-m"),
        period_end.format("%-d"),
    );
    let fields = "impressions,clicks,costInLocalCurrency,externalWebsiteConversions,externalWebsiteConversionValue";
    let url = format!(
        "https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=ACCOUNT&timeGranularity=ALL\
         &dateRange={date_range}&accounts[0]=urn:li:sponsoredAccount:{account_id}&fields={fields}"
    );

    let resp = http.get(url).headers(linkedin_headers(access_token)?).send().await?;
    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream { provider: "linkedin", message: body });
    }

    let parsed: AnalyticsResponse = resp.json().await?;
    let row = parsed.elements.into_iter().next().unwrap_or_default();

    Ok(RawMetrics {
        impressions: row.impressions.unwrap_or(0),
        clicks: row.clicks.unwrap_or(0),
        spend: row.cost_in_local_currency.and_then(|v| v.parse().ok()).unwrap_or(0.0),
        conversions: row.external_website_conversions.unwrap_or(0.0),
        revenue: row.external_website_conversion_value.unwrap_or(0.0),
        ..RawMetrics::default()
    })
}
