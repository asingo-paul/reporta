use serde::{Deserialize, Serialize};

/// A small pre-formatted table of one segmentation of the period's data (e.g.
/// "Sessions by channel", "Spend by campaign"). Providers build these from
/// dimension-level API queries; the insight engine feeds them to the model so
/// its analysis can be specific to *this* account, and the PDF/frontend render
/// them so the reader can see the detail behind the headline numbers.
///
/// Everything is a display string already — number formatting happens once,
/// where the raw values are known.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakdownSection {
    pub title: String,
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

impl BreakdownSection {
    pub fn new(title: impl Into<String>, columns: Vec<&str>) -> Self {
        Self {
            title: title.into(),
            columns: columns.into_iter().map(String::from).collect(),
            rows: Vec::new(),
        }
    }

    pub fn push_row(&mut self, row: Vec<String>) {
        self.rows.push(row);
    }

    pub fn is_empty(&self) -> bool {
        self.rows.is_empty()
    }

    /// Renders the section as a plain-text markdown-ish table for an LLM prompt.
    pub fn to_prompt_text(&self) -> String {
        let mut out = format!("{}\n{}\n", self.title, self.columns.join(" | "));
        out.push_str(&vec!["---"; self.columns.len()].join(" | "));
        out.push('\n');
        for row in &self.rows {
            out.push_str(&row.join(" | "));
            out.push('\n');
        }
        out
    }
}

/// Format a period-over-period change from two raw values, matching the style
/// used elsewhere (`+12.3%`, or `new` / `—`).
pub fn format_change(current: f64, previous: f64) -> String {
    if previous == 0.0 {
        if current == 0.0 {
            "—".to_string()
        } else {
            "new".to_string()
        }
    } else {
        format!("{:+.1}%", (current - previous) / previous.abs() * 100.0)
    }
}
