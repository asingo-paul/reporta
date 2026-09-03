use reporta_common::BreakdownSection;
use serde::Deserialize;

use crate::guard::{extract_numbers, find_unsupported_numbers};
use crate::openai::OpenAIClient;
use crate::prompt::{allowed_values, build_user_message, MetricPoint, SYSTEM_PROMPT};

/// The single entry point the `reports` crate calls.
pub struct InsightsEngine {
    client: OpenAIClient,
}

/// The AI narrative for one report: an executive summary, a list of
/// recommendations, and a forward-looking conclusion. `used_fallback` is true
/// when the LLM path failed and this is the deterministic template instead, so
/// the UI/PDF can flag it rather than pass it off as an analyst's work.
pub struct GeneratedSummary {
    pub summary: String,
    pub recommendations: Vec<String>,
    pub conclusion: String,
    pub used_fallback: bool,
}

#[derive(Deserialize)]
struct LlmNarrative {
    summary: String,
    #[serde(default)]
    recommendations: Vec<String>,
    #[serde(default)]
    conclusion: String,
}

/// Pull the JSON object out of a model response that may have leading/trailing
/// prose or code fences around it.
fn parse_narrative(raw: &str) -> Option<LlmNarrative> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    let parsed: LlmNarrative = serde_json::from_str(raw.get(start..=end)?).ok()?;
    if parsed.summary.trim().is_empty() {
        return None;
    }
    Some(parsed)
}

impl InsightsEngine {
    pub fn new(client: OpenAIClient) -> Self {
        Self { client }
    }

    /// Never fails: a missing/invalid API key, a network error, an unparseable
    /// response, or a model that keeps failing the numeric-hallucination guard
    /// all degrade to `deterministic_fallback` rather than blocking report
    /// generation.
    pub async fn generate_summary(
        &self,
        client_name: &str,
        period_label: &str,
        points: &[MetricPoint],
        breakdowns: &[BreakdownSection],
    ) -> GeneratedSummary {
        let user_message = build_user_message(client_name, period_label, points, breakdowns);
        // Anything already present in what we sent the model is fair to quote
        // back — the metric values, the dates/year in the period label, and the
        // breakdown tables. On top of that, a good analyst legitimately states
        // proportions ("Organic Search drove 83% of sessions"), so also allow
        // any share/rate the model could derive from two source numbers
        // (capped at 100). The guard still catches fabricated absolute figures
        // — invented revenue, user counts, etc.
        let mut allowed = allowed_values(points);
        let source_numbers = extract_numbers(&user_message);
        allowed.extend(source_numbers.iter().copied());
        for &a in &source_numbers {
            for &b in &source_numbers {
                if b > 0.0 {
                    let share = a / b * 100.0;
                    if (0.0..=100.5).contains(&share) {
                        allowed.push(share);
                        allowed.push(share.round());
                    }
                }
            }
        }

        let mut retry_hint: Option<&str> = None;
        for attempt in 0..2 {
            let prompt = match retry_hint {
                Some(hint) => format!("{user_message}\n\n{hint}"),
                None => user_message.clone(),
            };

            let raw = match self.client.complete(SYSTEM_PROMPT, &prompt).await {
                Ok(raw) => raw,
                Err(err) => {
                    tracing::warn!(error = %err, attempt, "LLM API call failed");
                    continue;
                }
            };

            let Some(narrative) = parse_narrative(&raw) else {
                tracing::warn!(attempt, "LLM response was not the expected JSON object");
                retry_hint = Some("Your previous answer was not valid JSON. Reply with ONLY the JSON object described, no other text.");
                continue;
            };

            let combined = format!(
                "{}\n{}\n{}",
                narrative.summary,
                narrative.recommendations.join("\n"),
                narrative.conclusion
            );
            let unsupported = find_unsupported_numbers(&combined, &allowed);
            if unsupported.is_empty() {
                return GeneratedSummary {
                    summary: narrative.summary.trim().to_string(),
                    recommendations: narrative
                        .recommendations
                        .into_iter()
                        .map(|r| r.trim().to_string())
                        .filter(|r| !r.is_empty())
                        .collect(),
                    conclusion: narrative.conclusion.trim().to_string(),
                    used_fallback: false,
                };
            }
            tracing::warn!(?unsupported, attempt, "AI narrative contained unsupported numbers");
            retry_hint = Some(
                "Your previous answer referenced numbers that don't appear in the data. Rewrite using ONLY figures from the data above. Do not invent or estimate any number.",
            );
        }
        tracing::warn!("AI narrative fell back to the deterministic template");
        deterministic_fallback(client_name, points)
    }
}

/// A safe, numbers-only-from-source narrative used when the model can't produce
/// a clean answer. `used_fallback` lets the caller flag it for close review.
fn deterministic_fallback(client_name: &str, points: &[MetricPoint]) -> GeneratedSummary {
    let biggest_win = points
        .iter()
        .filter_map(|p| p.delta_pct.map(|d| (p, d)))
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    let biggest_concern = points
        .iter()
        .filter_map(|p| p.delta_pct.map(|d| (p, d)))
        .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut sentences = vec![format!(
        "This report summarizes {client_name}'s performance for the period, based on {} tracked metrics.",
        points.len()
    )];
    if let Some((p, delta)) = biggest_win {
        sentences.push(format!(
            "The strongest movement was in {}, which changed by {:+.1}% versus the prior period.",
            p.kind.label(),
            delta
        ));
    }
    if let Some((p, delta)) = biggest_concern {
        sentences.push(format!(
            "The metric most worth reviewing is {}, which changed by {:+.1}% versus the prior period.",
            p.kind.label(),
            delta
        ));
    }
    sentences.push(
        "See the table below for the full breakdown of this period versus the previous one.".to_string(),
    );

    let mut recommendations = Vec::new();
    if let Some((p, delta)) = biggest_concern {
        if delta < 0.0 {
            recommendations.push(format!(
                "Investigate the {:+.1}% move in {} against any campaign, budget, or site changes in the same window.",
                delta,
                p.kind.label()
            ));
        }
    }
    if let Some((p, _)) = biggest_win {
        recommendations.push(format!(
            "Protect and, where possible, extend whatever drove the gain in {}.",
            p.kind.label()
        ));
    }
    recommendations
        .push("Confirm tracking and attribution are intact so next period's comparison is clean.".to_string());

    let conclusion = match biggest_concern {
        Some((p, _)) => format!(
            "Overall the account is stable; the priority next period is {}.",
            p.kind.label()
        ),
        None => "Overall the account is stable; keep the current approach and re-measure next period.".to_string(),
    };

    GeneratedSummary {
        summary: sentences.join(" "),
        recommendations,
        conclusion,
        used_fallback: true,
    }
}
