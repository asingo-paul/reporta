//! TikTok for Business Marketing API.
//!
//! Deliberately NOT built on the `oauth2` crate: TikTok's authorize URL uses
//! `app_id` instead of `client_id` and has no `scope`/`response_type`
//! parameters, and its token endpoint returns a TikTok-specific JSON envelope
//! (`{code, message, data: {access_token, advertiser_ids, ...}}`) rather than
//! a standard OAuth token response. Endpoint paths and field names here follow
//! TikTok's Marketing API v1.3 docs as of this writing — worth a quick check
//! against the live reference once real app credentials are in hand, since
//! this integration has not been exercised against a live TikTok account.

use chrono::NaiveDate;
use reporta_common::metrics::RawMetrics;
use serde::Deserialize;

use crate::error::IntegrationError;

const TOKEN_URL: &str = "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";
const REPORT_URL: &str = "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/";

#[derive(Deserialize)]
struct TikTokEnvelope<T> {
    code: i64,
    message: String,
    data: Option<T>,
}

#[derive(Deserialize)]
struct TokenData {
    access_token: String,
    #[serde(default)]
    advertiser_ids: Vec<String>,
}

/// Exchanges the authorization code for an access token. TikTok's OAuth
/// returns the authorized advertiser account(s) directly in this response —
/// no separate "list accounts" call is needed.
pub async fn exchange_code(
    http: &reqwest::Client,
    app_id: &str,
    app_secret: &str,
    auth_code: &str,
) -> Result<(String, Option<(String, Option<String>)>), IntegrationError> {
    let resp = http
        .post(TOKEN_URL)
        .json(&serde_json::json!({
            "app_id": app_id,
            "secret": app_secret,
            "auth_code": auth_code,
        }))
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream { provider: "tiktok", message: body });
    }

    let envelope: TikTokEnvelope<TokenData> = resp.json().await?;
    if envelope.code != 0 {
        return Err(IntegrationError::Upstream { provider: "tiktok", message: envelope.message });
    }
    let data = envelope.data.ok_or(IntegrationError::Upstream {
        provider: "tiktok",
        message: "token response had no data".to_string(),
    })?;

    let account = data.advertiser_ids.first().map(|id| (id.clone(), None));
    Ok((data.access_token, account))
}

#[derive(Deserialize)]
struct ReportData {
    #[serde(default)]
    list: Vec<ReportRow>,
}

#[derive(Deserialize)]
struct ReportRow {
    #[serde(default)]
    metrics: ReportMetrics,
}

#[derive(Deserialize, Default)]
struct ReportMetrics {
    #[serde(default)]
    spend: Option<String>,
    #[serde(default)]
    impressions: Option<String>,
    #[serde(default)]
    clicks: Option<String>,
    #[serde(default)]
    conversion: Option<String>,
    #[serde(default)]
    total_complete_payment: Option<String>,
}

/// Pulls aggregated spend/impressions/clicks/conversions for one advertiser
/// account over a date range via the Integrated Reporting endpoint.
pub async fn fetch_metrics(
    http: &reqwest::Client,
    access_token: &str,
    advertiser_id: &str,
    period_start: NaiveDate,
    period_end: NaiveDate,
) -> Result<RawMetrics, IntegrationError> {
    let metrics = ["spend", "impressions", "clicks", "conversion", "total_complete_payment"];
    let resp = http
        .get(REPORT_URL)
        .header("Access-Token", access_token)
        .query(&[
            ("advertiser_id", advertiser_id),
            ("report_type", "BASIC"),
            ("data_level", "AUCTION_ADVERTISER"),
            ("dimensions", "[\"advertiser_id\"]"),
            ("metrics", &serde_json::to_string(&metrics).unwrap_or_default()),
            ("start_date", &period_start.format("%Y-%m-%d").to_string()),
            ("end_date", &period_end.format("%Y-%m-%d").to_string()),
            ("page_size", "1"),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(IntegrationError::Upstream { provider: "tiktok", message: body });
    }

    let envelope: TikTokEnvelope<ReportData> = resp.json().await?;
    if envelope.code != 0 {
        return Err(IntegrationError::Upstream { provider: "tiktok", message: envelope.message });
    }
    let row = envelope.data.and_then(|d| d.list.into_iter().next()).map(|r| r.metrics).unwrap_or_default();

    Ok(RawMetrics {
        impressions: row.impressions.and_then(|v| v.parse().ok()).unwrap_or(0),
        clicks: row.clicks.and_then(|v| v.parse().ok()).unwrap_or(0),
        spend: row.spend.and_then(|v| v.parse().ok()).unwrap_or(0.0),
        conversions: row.conversion.and_then(|v| v.parse().ok()).unwrap_or(0.0),
        revenue: row.total_complete_payment.and_then(|v| v.parse().ok()).unwrap_or(0.0),
        ..RawMetrics::default()
    })
}
