use regex::Regex;
use reporta_common::BreakdownSection;
use std::sync::OnceLock;

pub struct MetricRow {
    pub label: String,
    pub current: String,
    pub previous: String,
    pub change: String,
    /// Period-over-period change, if a prior value existed. Drives the ▲/▼
    /// colour in the table and the "at a glance" tiles.
    pub delta_pct: Option<f64>,
}

pub struct ReportInput {
    pub agency_name: String,
    pub client_name: String,
    pub period_label: String,
    pub brand_primary_color: String,
    pub brand_secondary_color: String,
    pub intro_blurb: String,
    pub ai_summary: String,
    /// AI-generated actionable recommendations, rendered as a numbered list.
    pub ai_recommendations: Vec<String>,
    /// AI-generated forward-looking conclusion.
    pub ai_conclusion: String,
    pub ai_summary_was_edited: bool,
    /// True when the narrative is the deterministic fallback (LLM unavailable).
    pub ai_summary_is_fallback: bool,
    /// Human-readable data-source names for the report's attribution line.
    pub sources: Vec<String>,
    pub metrics: Vec<MetricRow>,
    /// Segment breakdown tables shown under the headline metrics.
    pub breakdowns: Vec<BreakdownSection>,
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
    src.push_str(&format!(
        "#let ai_conclusion = \"{}\"\n",
        escape_typst_string(&input.ai_conclusion)
    ));
    src.push_str("#let ai_recommendations = (\n");
    for rec in &input.ai_recommendations {
        src.push_str(&format!("  \"{}\",\n", escape_typst_string(rec)));
    }
    src.push_str(")\n");

    src.push_str("#align(center)[\n");
    if let Some(logo) = &input.logo_asset {
        src.push_str(&format!("  #image(\"{logo}\", width: 3cm)\n"));
        src.push_str("  #v(0.35cm)\n");
    }
    src.push_str("  #text(size: 20pt, weight: \"bold\", fill: brand_primary)[Performance Report]\n");
    src.push_str("  #v(0.15cm)\n");
    src.push_str("  #text(size: 12pt, fill: brand_secondary)[#client_name --- #period_label]\n");
    src.push_str("]\n");
    src.push_str("#v(0.35cm)\n");
    src.push_str("#line(length: 100%, stroke: 0.75pt + brand_secondary)\n");
    src.push_str("#v(0.4cm)\n");

    // Period-over-period change styling. Direction is carried by colour and the
    // signed percentage in the value itself — no glyphs, so it never depends on
    // a font shipping ▲/▼.
    src.push_str(
        "#let delta_color(dir) = if dir == \"up\" { rgb(\"#15803D\") } \
         else if dir == \"down\" { rgb(\"#B91C1C\") } else { rgb(\"#6B7280\") }\n",
    );

    src.push_str("== Introduction\n#intro_blurb\n\n");
    src.push_str("== Executive Summary\n#ai_summary\n\n");
    if input.ai_summary_is_fallback {
        src.push_str(
            "#block(fill: rgb(\"#FEF3C7\"), inset: 8pt, radius: 3pt, width: 100%)[#text(size: 8pt, fill: rgb(\"#92400E\"))[This narrative was generated from a template because the AI service was unavailable. Review before sending.]]\n\n",
        );
    } else if input.ai_summary_was_edited {
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
        let dir = match row.delta_pct {
            Some(p) if p > 0.05 => "up",
            Some(p) if p < -0.05 => "down",
            _ => "flat",
        };
        src.push_str(&format!(
            "  (\"{}\", \"{}\", \"{}\", \"{}\", \"{dir}\"),\n",
            escape_typst_string(&row.label),
            escape_typst_string(&row.current),
            escape_typst_string(&row.previous),
            escape_typst_string(&row.change),
        ));
    }
    src.push_str(")\n\n");

    // "At a glance": the first few metrics as headline tiles.
    let tile_count = input.metrics.len().min(4);
    if tile_count > 0 {
        src.push_str("== Key Metrics at a Glance\n");
        src.push_str(&format!(
            "#grid(columns: ({}), gutter: 0.35cm,\n",
            "1fr, ".repeat(tile_count).trim_end_matches(", ")
        ));
        for idx in 0..tile_count {
            src.push_str(&format!(
                "  block(fill: rgb(\"#F9FAFB\"), inset: 9pt, radius: 4pt, width: 100%)[\
                 #text(size: 7pt, fill: gray, weight: \"bold\")[#upper(metric_rows.at({idx}).at(0))] #v(2pt) \
                 #text(size: 15pt, weight: \"bold\", fill: brand_secondary)[#metric_rows.at({idx}).at(1)] #v(1pt) \
                 #text(size: 8pt, fill: delta_color(metric_rows.at({idx}).at(4)))[#metric_rows.at({idx}).at(3)]],\n"
            ));
        }
        src.push_str(")\n#v(0.5cm)\n\n");
    }

    src.push_str("== Full Metric Breakdown\n");
    src.push_str("#table(\n");
    src.push_str("  columns: (2fr, 1fr, 1fr, 1fr),\n");
    src.push_str("  align: (left, right, right, right),\n");
    src.push_str("  fill: (col, row) => if row == 0 { brand_primary } else if calc.even(row) { rgb(\"#F3F4F6\") } else { white },\n");
    src.push_str(
        "  [#text(fill: white, weight: \"bold\")[Metric]], [#text(fill: white, weight: \"bold\")[This Period]], [#text(fill: white, weight: \"bold\")[Previous Period]], [#text(fill: white, weight: \"bold\")[Change]],\n",
    );
    src.push_str(
        "  ..metric_rows.map(row => (\
         [#row.at(0)], [#row.at(1)], [#row.at(2)], \
         [#text(fill: delta_color(row.at(4)))[#row.at(3)]])).flatten()\n",
    );
    src.push_str(")\n");
    if !input.sources.is_empty() {
        let joined = input
            .sources
            .iter()
            .map(|s| escape_typst_string(s))
            .collect::<Vec<_>>()
            .join(", ");
        src.push_str(&format!(
            "#v(3pt)#text(size: 8pt, fill: gray)[Sources: {joined}]\n"
        ));
    }
    src.push('\n');

    // Segment breakdowns — the detail behind the headline numbers.
    for (si, section) in input.breakdowns.iter().enumerate() {
        if section.rows.is_empty() || section.columns.is_empty() {
            continue;
        }
        src.push_str(&format!("== {}\n", section.title.replace(['=', '#'], "")));
        src.push_str(&format!("#let bd_{si} = (\n"));
        for row in &section.rows {
            let cells: Vec<String> = section
                .columns
                .iter()
                .enumerate()
                .map(|(ci, _)| {
                    let v = row.get(ci).map(String::as_str).unwrap_or("");
                    format!("\"{}\"", escape_typst_string(v))
                })
                .collect();
            src.push_str(&format!("  ({}),\n", cells.join(", ")));
        }
        src.push_str(")\n");
        let ncols = section.columns.len();
        let col_spec = std::iter::once("2fr".to_string())
            .chain(std::iter::repeat("1fr".to_string()).take(ncols.saturating_sub(1)))
            .collect::<Vec<_>>()
            .join(", ");
        let aligns = std::iter::once("left")
            .chain(std::iter::repeat("right").take(ncols.saturating_sub(1)))
            .collect::<Vec<_>>()
            .join(", ");
        let headers: Vec<String> = section
            .columns
            .iter()
            .map(|c| format!("[#text(size: 8pt, fill: white, weight: \"bold\")[{}]]", escape_typst_string(c)))
            .collect();
        src.push_str("#table(\n");
        src.push_str(&format!("  columns: ({col_spec}),\n  align: ({aligns}),\n"));
        src.push_str("  inset: 5pt,\n");
        src.push_str("  fill: (col, row) => if row == 0 { brand_primary } else if calc.even(row) { rgb(\"#F3F4F6\") } else { white },\n");
        src.push_str(&format!("  {},\n", headers.join(", ")));
        src.push_str(&format!(
            "  ..bd_{si}.map(row => row.map(cell => [#text(size: 8pt)[#cell]])).flatten()\n"
        ));
        src.push_str(")\n#v(0.3cm)\n\n");
    }

    if let Some(chart) = &input.chart_asset {
        src.push_str("== Performance Trend\n");
        src.push_str(&format!("#image(\"{chart}\", width: 100%)\n\n"));
    }

    // Analyst's take goes after the numbers, so the reader sees the data first.
    if !input.ai_recommendations.is_empty() {
        src.push_str("== Recommendations\n");
        for (i, _) in input.ai_recommendations.iter().enumerate() {
            src.push_str(&format!(
                "#grid(columns: (0.7cm, 1fr), row-gutter: 4pt, [#text(weight: \"bold\", fill: brand_primary)[{}.]], [#ai_recommendations.at({i})])\n#v(3pt)\n",
                i + 1
            ));
        }
        src.push('\n');
    }
    if !input.ai_conclusion.trim().is_empty() {
        src.push_str("== Conclusion\n#ai_conclusion\n\n");
    }

    src.push_str("#v(1fr)\n");
    src.push_str(
        "#text(size: 8pt, fill: gray)[Generated by #agency_name via Reporta on #datetime.today().display()]\n",
    );

    src
}
