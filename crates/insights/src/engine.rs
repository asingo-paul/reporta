use crate::openai::OpenAIClient;
use crate::guard::find_unsupported_numbers;
use crate::prompt::{allowed_values, build_user_message, MetricPoint, SYSTEM_PROMPT};

/// The single entry point the `reports` crate calls. Returns the generated
/// summary and whether it had to fall back to the deterministic template
/// (surfaced so the UI/ops can tell when the LLM path is degraded).
pub struct InsightsEngine {
    client: OpenAIClient,
}

pub struct GeneratedSummary {
    pub text: String,
    pub used_fallback: bool,
}

impl InsightsEngine {
    pub fn new(client: OpenAIClient) -> Self {
        Self { client }
    }

    /// Never fails: a missing/invalid OpenAI API key, a network error, or
    /// a model response that keeps failing the numeric-hallucination guard
    /// all degrade to `deterministic_fallback_summary` rather than blocking
    /// report generation. `used_fallback` tells the caller (and eventually
    /// the UI) that this happened, so it's visible rather than silent.
    pub async fn generate_summary(
        &self,
        client_name: &str,
        period_label: &str,
        points: &[MetricPoint],
    ) -> GeneratedSummary {
        let user_message = build_user_message(client_name, period_label, points);
        let allowed = allowed_values(points);

        for attempt in 0..2 {
            let prompt = if attempt == 0 {
                user_message.clone()
            } else {
                format!(
                    "{user_message}\n\nYour previous answer referenced numbers that don't appear \
                     in the data above. Rewrite the summary using ONLY the numbers in the table. \
                     Do not invent or estimate any figure."
                )
            };

            let summary = match self.client.complete(SYSTEM_PROMPT, &prompt).await {
                Ok(summary) => summary,
                Err(err) => {
                    tracing::warn!(?err, attempt, "LLM API call failed");
                    break;
                }
            };
            let unsupported = find_unsupported_numbers(&summary, &allowed);
            if unsupported.is_empty() {
                return GeneratedSummary {
                    text: summary,
                    used_fallback: false,
                };
            }
            tracing::warn!(?unsupported, attempt, "AI summary contained unsupported numbers");
        }

        GeneratedSummary {
            text: deterministic_fallback_summary(client_name, points),
            used_fallback: true,
        }
    }
}

/// A safe, numbers-only-from-source summary used if the model can't produce
/// a clean answer after a retry. Never shown as a surprise: `used_fallback`
/// lets the caller flag it in the UI so the agency knows to review closely.
fn deterministic_fallback_summary(client_name: &str, points: &[MetricPoint]) -> String {
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

    sentences.join(" ")
}
