use regex::Regex;
use std::sync::OnceLock;

pub struct MetricRow {
    pub label: String,
    pub current: String,
    pub previous: String,
    pub change: String,
}

pub struct ReportInput {
    pub agency_name: String,
    pub client_name: String,
    pub period_label: String,
    pub brand_primary_color: String,
    pub brand_secondary_color: String,
    pub intro_blurb: String,
    pub ai_summary: String,
    pub ai_summary_was_edited: bool,
    pub metrics: Vec<MetricRow>,
    /// Filename of the logo asset registered in the `World`'s virtual file
    /// map, if one was uploaded (e.g. `"logo.png"`).
    pub logo_asset: Option<String>,
    /// Filename of the trend-chart SVG asset, if one was rendered.
    pub chart_asset: Option<String>,
}

/// Escapes a string for safe embedding inside a Typst string literal
/// (`"..."`). This is the *only* place user-controlled text (client names,
/// intro blurbs, the AI summary) enters the generated Typst source, and it
/// enters exclusively as string-literal content — never as raw markup — so
/// there is no way for a crafted value to break out into Typst code.
fn escape_typst_string(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => {}
            c if c.is_control() => {}
            c => out.push(c),
        }
    }
    out
}

fn hex_color_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^#[0-9A-Fa-f]{6}$").unwrap())
}

/// Defense in depth: even though colors are validated at the API boundary,
/// re-validate here before they're interpolated into Typst source, and fall
/// back to a safe default rather than ever passing through an unexpected
/// value.
fn safe_hex_color(value: &str, default: &str) -> String {
    if hex_color_re().is_match(value) {
        value.to_string()
    } else {
        default.to_string()
    }
}

/// Builds the full `.typ` source for one report. Every dynamic piece of text
/// is bound via `#let ... = "..."` (a string literal) and only ever
/// referenced afterward — the surrounding structural markup is fixed and
/// written by us, never by report data.
pub fn build_report_source(input: &ReportInput) -> String {
    let primary = safe_hex_color(&input.brand_primary_color, "#4F46E5");
    let secondary = safe_hex_color(&input.brand_secondary_color, "#111827");

    let mut src = String::new();
    src.push_str("#set page(paper: \"a4\", margin: (x: 2.2cm, y: 2.2cm))\n");
    src.push_str("#set text(font: \"Libertinus Serif\", size: 10.5pt)\n");
    src.push_str(&format!("#let brand_primary = rgb(\"{primary}\")\n"));
    src.push_str(&format!("#let brand_secondary = rgb(\"{secondary}\")\n"));
    src.push_str(&format!(
        "#let agency_name = \"{}\"\n",
        escape_typst_string(&input.agency_name)
    ));
    src.push_str(&format!(
        "#let client_name = \"{}\"\n",
        escape_typst_string(&input.client_name)
    ));
    src.push_str(&format!(
        "#let period_label = \"{}\"\n",
        escape_typst_string(&input.period_label)
    ));
    src.push_str(&format!(
        "#let intro_blurb = \"{}\"\n",
        escape_typst_string(&input.intro_blurb)
    ));
    src.push_str(&format!(
        "#let ai_summary = \"{}\"\n",
        escape_typst_string(&input.ai_summary)
    ));

    src.push_str("#block(width: 100%)[\n");
    if let Some(logo) = &input.logo_asset {
        src.push_str(&format!("  #image(\"{logo}\", width: 2.6cm)\n"));
        src.push_str("  #v(0.3cm)\n");
    }
    src.push_str("  #text(size: 20pt, weight: \"bold\", fill: brand_primary)[Performance Report]\n");
    src.push_str("  #v(0.15cm)\n");
    src.push_str("  #text(size: 12pt, fill: brand_secondary)[#client_name --- #period_label]\n");
    src.push_str("]\n");
    src.push_str("#line(length: 100%, stroke: 0.75pt + brand_secondary)\n");
    src.push_str("#v(0.4cm)\n");

    src.push_str("== Introduction\n#intro_blurb\n\n");
    src.push_str("== Executive Summary\n#ai_summary\n\n");
    if input.ai_summary_was_edited {
        src.push_str(
            "#text(size: 8pt, style: \"italic\", fill: gray)[This summary was reviewed and edited by the agency.]\n\n",
        );
    }

    // Metric cell values (currency/percent strings like "$1,200.00" or
    // "+20.0%") are never spliced into bare markup — `$` and other markup
    // sigils there would be re-lexed as Typst syntax (e.g. `$` toggles math
    // mode) and corrupt the table. Instead every cell is built as a Typst
    // *string literal* inside a code-mode array, and only ever displayed via
    // `#cell` interpolation, which shows a string's characters verbatim with
    // no re-parsing — the same safe pattern used for the intro/summary text.
    src.push_str("#let metric_rows = (\n");
    for row in &input.metrics {
        src.push_str(&format!(
            "  (\"{}\", \"{}\", \"{}\", \"{}\"),\n",
            escape_typst_string(&row.label),
            escape_typst_string(&row.current),
            escape_typst_string(&row.previous),
            escape_typst_string(&row.change),
        ));
    }
    src.push_str(")\n\n");

    src.push_str("== Key Metrics at a Glance\n");
    src.push_str("#table(\n");
    src.push_str("  columns: (2fr, 1fr, 1fr, 1fr),\n");
    src.push_str("  fill: (col, row) => if row == 0 { brand_primary } else if calc.even(row) { rgb(\"#F3F4F6\") } else { white },\n");
    src.push_str(
        "  [#text(fill: white, weight: \"bold\")[Metric]], [#text(fill: white, weight: \"bold\")[This Period]], [#text(fill: white, weight: \"bold\")[Previous Period]], [#text(fill: white, weight: \"bold\")[Change]],\n",
    );
    src.push_str("  ..metric_rows.map(row => row.map(cell => [#cell])).flatten()\n");
    src.push_str(")\n\n");

    if let Some(chart) = &input.chart_asset {
        src.push_str("== Performance Trend\n");
        src.push_str(&format!("#image(\"{chart}\", width: 100%)\n\n"));
    }

    src.push_str("#v(1fr)\n");
    src.push_str(
        "#text(size: 8pt, fill: gray)[Generated by #agency_name via Reporta on #datetime.today().display()]\n",
    );

    src
}
