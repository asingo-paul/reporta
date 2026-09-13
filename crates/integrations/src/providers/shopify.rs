use chrono::NaiveDate;
use reporta_common::metrics::RawMetrics;
use serde::Deserialize;

use crate::error::IntegrationError;

const API_VERSION: &str = "2024-10";
/// Bounds the pagination loop below — 10 pages x 250 orders covers even a
/// busy store's month, and keeps one report generation from turning into an
/// unbounded crawl of a huge order history.
const MAX_PAGES: u32 = 10;

#[derive(Deserialize)]
struct OrdersResponse {
    #[serde(default)]
    orders: Vec<OrderRow>,
}

#[derive(Deserialize)]
struct OrderRow {
    #[serde(default)]
    current_total_price: Option<String>,
    #[serde(default)]
    cancelled_at: Option<String>,
}

/// Pulls order count and revenue for a store over a date range via the Admin
/// REST API, paginating on Shopify's `Link` header. Shopify has no concept of
/// ad impressions/clicks, so those fields stay zero. Cancelled orders are
/// excluded from both the count and the revenue total.
pub async fn fetch_metrics(
    http: &reqwest::Client,
    access_token: &str,
    shop_domain: &str,
    period_start: NaiveDate,
    period_end: NaiveDate,
) -> Result<RawMetrics, IntegrationError> {
    let min = format!("{}T00:00:00Z", period_start.format("%Y-%m-%d"));
    let max = format!("{}T23:59:59Z", period_end.format("%Y-%m-%d"));

    let mut orders = 0i64;
    let mut revenue = 0.0f64;
    let mut url = format!(
        "https://{shop_domain}/admin/api/{API_VERSION}/orders.json?status=any&limit=250\
         &created_at_min={min}&created_at_max={max}&fields=current_total_price,cancelled_at"
    );

    for _ in 0..MAX_PAGES {
        let resp = http.get(&url).header("X-Shopify-Access-Token", access_token).send().await?;
        if !resp.status().is_success() {
            let message = resp.text().await.unwrap_or_default();
            return Err(IntegrationError::Upstream { provider: "shopify", message });
        }

        let next_url = next_page_url(resp.headers());
        let parsed: OrdersResponse = resp.json().await?;
        if parsed.orders.is_empty() {
            break;
        }
        for order in parsed.orders {
            if order.cancelled_at.is_some() {
                continue;
            }
            orders += 1;
            revenue += order.current_total_price.and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0);
        }

        match next_url {
            Some(next) => url = next,
            None => break,
        }
    }

    Ok(RawMetrics { orders, revenue, ..RawMetrics::default() })
}

/// Shopify paginates via an RFC 5988 `Link` header (`<url>; rel="next"`)
/// rather than a page number — this is the only way to get the next page.
fn next_page_url(headers: &reqwest::header::HeaderMap) -> Option<String> {
    let link = headers.get(reqwest::header::LINK)?.to_str().ok()?;
    link.split(',').find_map(|part| {
        let part = part.trim();
        if !part.contains("rel=\"next\"") {
            return None;
        }
        let start = part.find('<')? + 1;
        let end = part.find('>')?;
        Some(part[start..end].to_string())
    })
}
