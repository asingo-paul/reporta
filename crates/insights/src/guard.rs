use regex::Regex;
use std::sync::OnceLock;

fn number_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"[-+]?\$?\d[\d,]*(?:\.\d+)?%?").unwrap())
}

/// Pulls every number the model wrote out of free text, stripping currency
/// signs, thousands separators, and percent signs down to a bare `f64`.
pub fn extract_numbers(text: &str) -> Vec<f64> {
    number_regex()
        .find_iter(text)
        .filter_map(|m| {
            let cleaned: String = m
                .as_str()
                .chars()
                .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-' || *c == '+')
                .collect();
            cleaned.parse::<f64>().ok()
        })
        .collect()
}

/// Numbers this small (sentence counts, "top 3", ordinals, etc.) are common
/// English filler and not worth flagging even if they don't match source
/// data exactly.
const IGNORE_BELOW: f64 = 5.0;

/// Relative tolerance for matching a model-written number against a source
/// value, to absorb rounding (the model might write "$1,240" for
/// 1239.87, or "12%" for 12.3%).
const RELATIVE_TOLERANCE: f64 = 0.02;
const ABSOLUTE_TOLERANCE: f64 = 1.0;

fn matches_any(value: f64, allowed: &[f64]) -> bool {
    allowed.iter().any(|&a| {
        let diff = (value - a).abs();
        diff <= ABSOLUTE_TOLERANCE || diff <= a.abs() * RELATIVE_TOLERANCE
    })
}

/// Cross-checks every number the model wrote against the real numbers we
/// sent it. Returns the list of numbers that don't correspond to anything in
/// the source data — a non-empty result means the summary likely contains a
/// hallucinated figure and should not be shown to a client as-is.
pub fn find_unsupported_numbers(summary: &str, allowed: &[f64]) -> Vec<f64> {
    extract_numbers(summary)
        .into_iter()
        .filter(|&v| v.abs() >= IGNORE_BELOW)
        .filter(|&v| !matches_any(v, allowed))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_currency_and_percentages() {
        let nums = extract_numbers("Spend rose to $1,240.50, a +12.3% increase over 900 clicks.");
        assert!(nums.contains(&1240.50));
        assert!(nums.contains(&12.3));
        assert!(nums.contains(&900.0));
    }

    #[test]
    fn accepts_numbers_within_tolerance() {
        let allowed = vec![1239.87, 12.34];
        let unsupported = find_unsupported_numbers("Spend was $1,240, up 12%.", &allowed);
        assert!(unsupported.is_empty(), "unexpected unsupported: {unsupported:?}");
    }

    #[test]
    fn flags_fabricated_number() {
        let allowed = vec![1239.87, 12.34];
        let unsupported = find_unsupported_numbers("Spend was $1,240, but conversions hit 5000.", &allowed);
        assert_eq!(unsupported, vec![5000.0]);
    }

    #[test]
    fn ignores_small_filler_numbers() {
        let allowed = vec![1239.87];
        let unsupported = find_unsupported_numbers("Here are the top 3 takeaways in 4 sentences.", &allowed);
        assert!(unsupported.is_empty());
    }
}
