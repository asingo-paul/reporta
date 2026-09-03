use reporta_common::metrics::{format_metric_value, MetricKind};
use reporta_common::BreakdownSection;

/// Strict analyst prompt. The model must return one JSON object — an executive
/// summary, actionable recommendations, and a forward-looking conclusion — and
/// may only use numbers that appear in the data it is given. It is pushed hard
/// toward analysis that could only have been written about THIS account.
pub const SYSTEM_PROMPT: &str = "You are a senior marketing analyst writing a review a client will read to decide what to do next.\n\
You are given a client's real metrics for a period, the prior period for comparison, and — where available — segment breakdowns (traffic by channel and device, top landing pages, ad spend by campaign).\n\
\n\
Write a review that could ONLY have been written about THIS data. For every point, cite the specific number or segment it rests on and name the most likely mechanism behind the move. When a breakdown explains a headline change, say which segment drove it.\n\
Ban generic filler. Do NOT write 'set up conversion tracking', 'monitor weekly', 'run more campaigns', 'optimise the funnel', 'improve SEO' or similar unless a specific figure in the data points directly to that action.\n\
\n\
Reply with ONE raw JSON object and nothing else (no markdown, no code fences):\n\
{\"summary\": string, \"recommendations\": [string], \"conclusion\": string}\n\
- \"summary\": 3 to 5 sentences. Lead with the single most important shift. Name the biggest win and the biggest concern with their numbers, and where a breakdown explains a move, attribute it.\n\
- \"recommendations\": 2 to 4 items, ordered by impact. Each item must (a) cite a specific figure or segment from the data, (b) state one concrete action, and (c) state the expected effect.\n\
- \"conclusion\": 1 to 2 sentences on the trajectory and the single priority for next period.\n\
\n\
Use only numbers that appear in the data. Do not invent, estimate, or extrapolate. You may state a proportion between two figures in the data (e.g. 'about two-thirds of sessions'), but prefer words over new percentages you calculate. If the data is too thin to justify a recommendation, say what additional data is needed rather than guessing.";

#[derive(Debug, Clone)]
pub struct MetricPoint {
    pub kind: MetricKind,
    pub current: f64,
    pub previous: f64,
    pub delta_pct: Option<f64>,
}

/// Renders the headline metric table plus any segment breakdowns as plain text
/// for the model's user turn. Every number here is one the numeric-hallucination
/// guard will later treat as "allowed".
pub fn build_user_message(
    client_name: &str,
    period_label: &str,
    points: &[MetricPoint],
    breakdowns: &[BreakdownSection],
) -> String {
    let mut lines = vec![
        format!("Client: {client_name}"),
        format!("Reporting period: {period_label}"),
        String::new(),
        "HEADLINE METRICS".to_string(),
        "Metric | This period | Previous period | Change".to_string(),
        "-------|-------------|------------------|-------".to_string(),
    ];
    for p in points {
        let change = match p.delta_pct {
            Some(pct) => format!("{:+.1}%", pct),
            None => "n/a (no prior data)".to_string(),
        };
        lines.push(format!(
            "{} | {} | {} | {}",
            p.kind.label(),
            format_metric_value(p.kind, p.current),
            format_metric_value(p.kind, p.previous),
            change
        ));
    }

    for section in breakdowns {
        if section.is_empty() {
            continue;
        }
        lines.push(String::new());
        lines.push(section.to_prompt_text().trim_end().to_string());
    }

    lines.join("\n")
}

/// Every numeric value that legitimately appears in the source data — the
/// numeric-hallucination guard treats anything else the model writes as
/// suspect. Both raw and one-decimal-rounded delta percentages are included
/// since the model may round when prose-ifying (e.g. "+12%" for +12.3%).
pub fn allowed_values(points: &[MetricPoint]) -> Vec<f64> {
    let mut values = Vec::new();
    for p in points {
        values.push(p.current);
        values.push(p.previous);
        if let Some(pct) = p.delta_pct {
            values.push(pct);
            values.push(pct.round());
            values.push(pct.abs());
            values.push(pct.abs().round());
        }
    }
    values
}
