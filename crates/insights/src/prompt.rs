use reporta_common::metrics::{format_metric_value, MetricKind};

/// The exact strict prompt specified in the product brief (`Reporta.pdf`,
/// Backend Action 3). Kept verbatim and in one place so it's never
/// accidentally drifted by a future edit.
pub const SYSTEM_PROMPT: &str = "You are a senior marketing analyst. Given this data, write a 4-sentence executive summary. Highlight the biggest win and the biggest area of concern. Do not hallucinate numbers. Be objective.";

#[derive(Debug, Clone)]
pub struct MetricPoint {
    pub kind: MetricKind,
    pub current: f64,
    pub previous: f64,
    pub delta_pct: Option<f64>,
}

/// Renders the metric table as plain text for the model's user turn. Every
/// number that appears here is one the numeric-hallucination guard will
/// later treat as "allowed" in the model's response.
pub fn build_user_message(client_name: &str, period_label: &str, points: &[MetricPoint]) -> String {
    let mut lines = vec![
        format!("Client: {client_name}"),
        format!("Reporting period: {period_label}"),
        String::new(),
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
