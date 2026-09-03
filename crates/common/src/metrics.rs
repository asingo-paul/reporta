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

/// One raw counter a provider API can return. Metrics are derived from these,
/// and a `MetricKind` is only shown on a report when every raw field it needs
/// is supplied by at least one connected provider (see `available_metrics`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RawField {
    Impressions,
    Clicks,
    Spend,
    Conversions,
    Revenue,
    Sessions,
    TotalUsers,
    NewUsers,
    PageViews,
    EngagedSessions,
    EngagementTime,
}

impl Provider {
    /// The raw fields this provider's `fetch_metrics` populates. Meta and
    /// Google Ads are advertising sources (spend/clicks/impressions); GA4 is a
    /// website-analytics source (sessions/users/pageviews/engagement) that also
    /// reports key events and revenue.
    pub fn supplies(&self) -> &'static [RawField] {
        match self {
            Provider::Meta | Provider::GoogleAds => &[
                RawField::Impressions,
                RawField::Clicks,
                RawField::Spend,
                RawField::Conversions,
                RawField::Revenue,
            ],
            Provider::Ga4 => &[
                RawField::Sessions,
                RawField::TotalUsers,
                RawField::NewUsers,
                RawField::PageViews,
                RawField::EngagedSessions,
                RawField::EngagementTime,
                RawField::Conversions,
                RawField::Revenue,
            ],
        }
    }
}

/// The toggleable report metrics from the spec's Template Builder: the 10
/// standard advertising metrics plus the GA4 website-traffic metrics.
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
    // Website traffic (GA4)
    Sessions,
    TotalUsers,
    NewUsers,
    PageViews,
    EngagementRate,
    AvgEngagementTime,
}

impl MetricKind {
    pub const ALL: [MetricKind; 16] = [
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
        MetricKind::Sessions,
        MetricKind::TotalUsers,
        MetricKind::NewUsers,
        MetricKind::PageViews,
        MetricKind::EngagementRate,
        MetricKind::AvgEngagementTime,
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
            MetricKind::Sessions => "Sessions",
            MetricKind::TotalUsers => "Total Users",
            MetricKind::NewUsers => "New Users",
            MetricKind::PageViews => "Page Views",
            MetricKind::EngagementRate => "Engagement Rate",
            MetricKind::AvgEngagementTime => "Avg. Engagement Time",
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
            MetricKind::Sessions => "sessions",
            MetricKind::TotalUsers => "total_users",
            MetricKind::NewUsers => "new_users",
            MetricKind::PageViews => "page_views",
            MetricKind::EngagementRate => "engagement_rate",
            MetricKind::AvgEngagementTime => "avg_engagement_time",
        }
    }

    pub fn from_str_opt(s: &str) -> Option<MetricKind> {
        MetricKind::ALL.into_iter().find(|m| m.as_str() == s)
    }

    /// The raw fields required to compute this metric. A metric is only offered
    /// on a report when every one of these is supplied by a connected provider.
    pub fn required_fields(&self) -> &'static [RawField] {
        match self {
            MetricKind::Impressions => &[RawField::Impressions],
            MetricKind::Clicks => &[RawField::Clicks],
            MetricKind::Spend => &[RawField::Spend],
            MetricKind::Ctr => &[RawField::Clicks, RawField::Impressions],
            MetricKind::Cpc => &[RawField::Spend, RawField::Clicks],
            MetricKind::Conversions => &[RawField::Conversions],
            MetricKind::ConversionRate => &[RawField::Conversions, RawField::Clicks],
            MetricKind::CostPerConversion => &[RawField::Spend, RawField::Conversions],
            MetricKind::Revenue => &[RawField::Revenue],
            MetricKind::Roas => &[RawField::Revenue, RawField::Spend],
            MetricKind::Sessions => &[RawField::Sessions],
            MetricKind::TotalUsers => &[RawField::TotalUsers],
            MetricKind::NewUsers => &[RawField::NewUsers],
            MetricKind::PageViews => &[RawField::PageViews],
            MetricKind::EngagementRate => &[RawField::EngagedSessions, RawField::Sessions],
            MetricKind::AvgEngagementTime => &[RawField::EngagementTime, RawField::TotalUsers],
        }
    }

    /// True for percentage/ratio metrics that should be formatted with a `%`.
    pub fn is_percentage(&self) -> bool {
        matches!(
            self,
            MetricKind::Ctr | MetricKind::ConversionRate | MetricKind::EngagementRate
        )
    }

    /// True for currency metrics that should be formatted with a currency symbol.
    pub fn is_currency(&self) -> bool {
        matches!(
            self,
            MetricKind::Spend | MetricKind::Cpc | MetricKind::CostPerConversion | MetricKind::Revenue
        )
    }

    /// True for a duration metric formatted as `Xm Ys`.
    pub fn is_duration(&self) -> bool {
        matches!(self, MetricKind::AvgEngagementTime)
    }

    /// Which broad data family this metric belongs to. Used so a saved template
    /// that predates a family (e.g. an old ad-metrics-only template) still shows
    /// every metric of a newly-connected family rather than hiding it.
    pub fn family(&self) -> MetricFamily {
        match self {
            MetricKind::Sessions
            | MetricKind::TotalUsers
            | MetricKind::NewUsers
            | MetricKind::PageViews
            | MetricKind::EngagementRate
            | MetricKind::AvgEngagementTime => MetricFamily::Traffic,
            _ => MetricFamily::Advertising,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetricFamily {
    Advertising,
    Traffic,
}

/// Every `MetricKind` whose required raw fields are all supplied by at least
/// one of the connected providers. Order follows `MetricKind::ALL` so the
/// advertising metrics stay grouped ahead of the traffic metrics.
pub fn available_metrics(providers: &[Provider]) -> Vec<MetricKind> {
    let supplied: Vec<RawField> = providers.iter().flat_map(|p| p.supplies().iter().copied()).collect();
    MetricKind::ALL
        .into_iter()
        .filter(|m| m.required_fields().iter().all(|f| supplied.contains(f)))
        .collect()
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
    // Website traffic (GA4). Zero from advertising providers.
    #[serde(default)]
    pub sessions: i64,
    #[serde(default)]
    pub total_users: i64,
    #[serde(default)]
    pub new_users: i64,
    #[serde(default)]
    pub page_views: i64,
    #[serde(default)]
    pub engaged_sessions: i64,
    #[serde(default)]
    pub engagement_time_secs: f64,
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
            sessions: self.sessions + rhs.sessions,
            total_users: self.total_users + rhs.total_users,
            new_users: self.new_users + rhs.new_users,
            page_views: self.page_views + rhs.page_views,
            engaged_sessions: self.engaged_sessions + rhs.engaged_sessions,
            engagement_time_secs: self.engagement_time_secs + rhs.engagement_time_secs,
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
    pub sessions: i64,
    pub total_users: i64,
    pub new_users: i64,
    pub page_views: i64,
    pub engagement_rate: f64,
    pub avg_engagement_time: f64,
}

impl From<RawMetrics> for DerivedMetrics {
    fn from(raw: RawMetrics) -> Self {
        let ctr = safe_div(raw.clicks as f64, raw.impressions as f64) * 100.0;
        let cpc = safe_div(raw.spend, raw.clicks as f64);
        let conversion_rate = safe_div(raw.conversions, raw.clicks as f64) * 100.0;
        let cost_per_conversion = safe_div(raw.spend, raw.conversions);
        let roas = safe_div(raw.revenue, raw.spend);
        let engagement_rate = safe_div(raw.engaged_sessions as f64, raw.sessions as f64) * 100.0;
        let avg_engagement_time = safe_div(raw.engagement_time_secs, raw.total_users as f64);

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
            sessions: raw.sessions,
            total_users: raw.total_users,
            new_users: raw.new_users,
            page_views: raw.page_views,
            engagement_rate,
            avg_engagement_time,
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
            MetricKind::Sessions => self.sessions as f64,
            MetricKind::TotalUsers => self.total_users as f64,
            MetricKind::NewUsers => self.new_users as f64,
            MetricKind::PageViews => self.page_views as f64,
            MetricKind::EngagementRate => self.engagement_rate,
            MetricKind::AvgEngagementTime => self.avg_engagement_time,
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
        format!("${}", group_thousands(&format!("{value:.2}")))
    } else if kind.is_percentage() {
        format!("{value:.2}%")
    } else if kind.is_duration() {
        format_duration_secs(value)
    } else if matches!(
        kind,
        MetricKind::Impressions
            | MetricKind::Clicks
            | MetricKind::Conversions
            | MetricKind::Sessions
            | MetricKind::TotalUsers
            | MetricKind::NewUsers
            | MetricKind::PageViews
    ) {
        group_thousands(&format!("{:.0}", value.round()))
    } else {
        group_thousands(&format!("{value:.2}"))
    }
}

/// `754` seconds -> `"12m 34s"`, `< 60s` -> `"34s"`.
fn format_duration_secs(secs: f64) -> String {
    let total = secs.round().max(0.0) as i64;
    let (m, s) = (total / 60, total % 60);
    if m > 0 {
        format!("{m}m {s}s")
    } else {
        format!("{s}s")
    }
}

/// Inserts thousands separators into a plain decimal string like `-1234567.89`,
/// preserving any leading sign and fractional part: `-1,234,567.89`.
fn group_thousands(s: &str) -> String {
    let (sign, rest) = match s.strip_prefix('-') {
        Some(r) => ("-", r),
        None => ("", s),
    };
    let (int_part, frac_part) = match rest.split_once('.') {
        Some((i, f)) => (i, Some(f)),
        None => (rest, None),
    };
    let mut grouped = String::new();
    let digits: Vec<char> = int_part.chars().collect();
    for (idx, ch) in digits.iter().enumerate() {
        if idx > 0 && (digits.len() - idx) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(*ch);
    }
    match frac_part {
        Some(f) => format!("{sign}{grouped}.{f}"),
        None => format!("{sign}{grouped}"),
    }
}

fn safe_div(numerator: f64, denominator: f64) -> f64 {
    if denominator == 0.0 {
        0.0
    } else {
        numerator / denominator
    }
}
