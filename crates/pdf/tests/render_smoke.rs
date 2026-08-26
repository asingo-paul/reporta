use reporta_pdf::{render_comparison_chart, render_report_pdf, MetricRow, ReportInput};

#[test]
fn renders_a_complete_report_pdf() {
    let chart_svg = render_comparison_chart(
        "Spend vs. Conversions",
        &[
            ("Spend".to_string(), 1000.0, 1200.0),
            ("Conversions".to_string(), 40.0, 55.0),
        ],
    )
    .expect("chart should render");
    assert!(chart_svg.contains("<svg"));

    let input = ReportInput {
        agency_name: "Acme Agency".to_string(),
        client_name: "Test Client \"Quotes\" & <Brackets>".to_string(),
        period_label: "Jan 1 - Jan 31, 2026".to_string(),
        brand_primary_color: "#4F46E5".to_string(),
        brand_secondary_color: "#111827".to_string(),
        intro_blurb: "Here is your monthly performance report.".to_string(),
        ai_summary: "Spend rose 20% while conversions grew 37.5%, a strong month overall.".to_string(),
        ai_summary_was_edited: false,
        metrics: vec![
            MetricRow {
                label: "Spend".to_string(),
                current: "$1,200.00".to_string(),
                previous: "$1,000.00".to_string(),
                change: "+20.0%".to_string(),
            },
            MetricRow {
                label: "Conversions".to_string(),
                current: "55".to_string(),
                previous: "40".to_string(),
                change: "+37.5%".to_string(),
            },
        ],
        logo_asset: None,
        chart_asset: Some("chart.svg".to_string()),
    };

    let pdf_bytes = render_report_pdf(&input, None, Some(("chart.svg".to_string(), chart_svg)))
        .expect("report should render to PDF");

    assert!(pdf_bytes.starts_with(b"%PDF"));
    assert!(pdf_bytes.len() > 1000, "PDF suspiciously small: {} bytes", pdf_bytes.len());
}

#[test]
fn rejects_malicious_color_by_falling_back_to_default() {
    let input = ReportInput {
        agency_name: "Acme".to_string(),
        client_name: "Client".to_string(),
        period_label: "This month".to_string(),
        brand_primary_color: "\"); #import(\"evil\")".to_string(),
        brand_secondary_color: "#111827".to_string(),
        intro_blurb: "Intro".to_string(),
        ai_summary: "Summary".to_string(),
        ai_summary_was_edited: false,
        metrics: vec![],
        logo_asset: None,
        chart_asset: None,
    };

    // Must still compile to a valid PDF — the bogus color value gets
    // replaced with a safe default rather than being interpolated raw.
    let pdf_bytes = render_report_pdf(&input, None, None).expect("should not fail or inject code");
    assert!(pdf_bytes.starts_with(b"%PDF"));
}
