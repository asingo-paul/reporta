use serde::{Deserialize, Serialize};
use std::fmt;

/// The third-party data sources Reporta can connect to. MVP-limited to three,
/// per spec (`Reporta.pdf`): TikTok/LinkedIn/Bing are explicitly deferred.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "provider", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum Provider {
    Meta,
    Ga4,
    GoogleAds,
}

impl fmt::Display for Provider {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Provider::Meta => "meta",
            Provider::Ga4 => "ga4",
            Provider::GoogleAds => "google_ads",
        };
        write!(f, "{s}")
    }
}

/// The 10 standard, toggleable report metrics from the spec's Template Builder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetricKind {
    Impressions,
    Clicks,
    Spend,
    Ctr,
    Cpc,
    Conversions,
    ConversionRate,
    CostPerConversion,
    Revenue,
    Roas,
}

impl MetricKind {
    pub const ALL: [MetricKind; 10] = [
        MetricKind::Impressions,
        MetricKind::Clicks,
        MetricKind::Spend,
        MetricKind::Ctr,
        MetricKind::Cpc,
        MetricKind::Conversions,
        MetricKind::ConversionRate,
        MetricKind::CostPerConversion,
        MetricKind::Revenue,
        MetricKind::Roas,
    ];

    pub fn label(&self) -> &'static str {
        match self {
            MetricKind::Impressions => "Impressions",
            MetricKind::Clicks => "Clicks",
            MetricKind::Spend => "Spend",
            MetricKind::Ctr => "CTR",
            MetricKind::Cpc => "CPC",
            MetricKind::Conversions => "Conversions",
            MetricKind::ConversionRate => "Conversion Rate",
            MetricKind::CostPerConversion => "Cost per Conversion",
            MetricKind::Revenue => "Revenue",
            MetricKind::Roas => "ROAS",
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            MetricKind::Impressions => "impressions",
            MetricKind::Clicks => "clicks",
            MetricKind::Spend => "spend",
            MetricKind::Ctr => "ctr",
            MetricKind::Cpc => "cpc",
            MetricKind::Conversions => "conversions",
            MetricKind::ConversionRate => "conversion_rate",
            MetricKind::CostPerConversion => "cost_per_conversion",
            MetricKind::Revenue => "revenue",
            MetricKind::Roas => "roas",
        }
    }

    pub fn from_str_opt(s: &str) -> Option<MetricKind> {
        MetricKind::ALL.into_iter().find(|m| m.as_str() == s)
    }

    /// True for percentage/ratio metrics that should be formatted with a `%`.
    pub fn is_percentage(&self) -> bool {
        matches!(self, MetricKind::Ctr | MetricKind::ConversionRate)
    }

    /// True for currency metrics that should be formatted with a currency symbol.
    pub fn is_currency(&self) -> bool {
        matches!(
            self,
            MetricKind::Spend | MetricKind::Cpc | MetricKind::CostPerConversion | MetricKind::Revenue
        )
    }
}

/// Raw, additive counters pulled directly from a provider API for a given
/// date range. This is the "normalization" target every provider client maps
/// into (Backend Action 2 in the spec).
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct RawMetrics {
    pub impressions: i64,
    pub clicks: i64,
    pub spend: f64,
    pub conversions: f64,
    pub revenue: f64,
}

impl std::ops::Add for RawMetrics {
    type Output = RawMetrics;
    fn add(self, rhs: Self) -> Self::Output {
        RawMetrics {
            impressions: self.impressions + rhs.impressions,
            clicks: self.clicks + rhs.clicks,
            spend: self.spend + rhs.spend,
            conversions: self.conversions + rhs.conversions,
            revenue: self.revenue + rhs.revenue,
        }
    }
}

/// Fully derived metric set (raw counters + computed ratios), the shape the
/// insight engine and PDF renderer both consume.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct DerivedMetrics {
    pub impressions: i64,
    pub clicks: i64,
    pub spend: f64,
    pub conversions: f64,
    pub revenue: f64,
    pub ctr: f64,
    pub cpc: f64,
    pub conversion_rate: f64,
    pub cost_per_conversion: f64,
    pub roas: f64,
}

impl From<RawMetrics> for DerivedMetrics {
    fn from(raw: RawMetrics) -> Self {
        let ctr = safe_div(raw.clicks as f64, raw.impressions as f64) * 100.0;
        let cpc = safe_div(raw.spend, raw.clicks as f64);
        let conversion_rate = safe_div(raw.conversions, raw.clicks as f64) * 100.0;
        let cost_per_conversion = safe_div(raw.spend, raw.conversions);
        let roas = safe_div(raw.revenue, raw.spend);

        DerivedMetrics {
            impressions: raw.impressions,
            clicks: raw.clicks,
            spend: raw.spend,
            conversions: raw.conversions,
            revenue: raw.revenue,
            ctr,
            cpc,
            conversion_rate,
            cost_per_conversion,
            roas,
        }
    }
}

impl DerivedMetrics {
    pub fn value_of(&self, kind: MetricKind) -> f64 {
        match kind {
            MetricKind::Impressions => self.impressions as f64,
            MetricKind::Clicks => self.clicks as f64,
            MetricKind::Spend => self.spend,
            MetricKind::Ctr => self.ctr,
            MetricKind::Cpc => self.cpc,
            MetricKind::Conversions => self.conversions,
            MetricKind::ConversionRate => self.conversion_rate,
            MetricKind::CostPerConversion => self.cost_per_conversion,
            MetricKind::Revenue => self.revenue,
            MetricKind::Roas => self.roas,
        }
    }

    /// Percentage change vs. a prior period for a given metric. `None` when
    /// the prior value was zero (change % is undefined, not infinite/zero).
    pub fn delta_pct(&self, previous: &DerivedMetrics, kind: MetricKind) -> Option<f64> {
        let prev = previous.value_of(kind);
        let curr = self.value_of(kind);
        if prev == 0.0 {
            return None;
        }
        Some(((curr - prev) / prev.abs()) * 100.0)
    }
}

/// Shared human-readable formatting for a metric value, used both in the
/// prompt sent to the insight engine and in the PDF's metrics table — kept
/// in one place so the two always agree on what "the number" looks like.
pub fn format_metric_value(kind: MetricKind, value: f64) -> String {
    if kind.is_currency() {
        format!("${value:.2}")
    } else if kind.is_percentage() {
        format!("{value:.2}%")
    } else if matches!(kind, MetricKind::Impressions | MetricKind::Clicks) {
        format!("{value:.0}")
    } else {
        format!("{value:.2}")
    }
}

fn safe_div(numerator: f64, denominator: f64) -> f64 {
    if denominator == 0.0 {
        0.0
    } else {
        numerator / denominator
    }
}
