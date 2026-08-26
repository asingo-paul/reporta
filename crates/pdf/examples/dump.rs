use reporta_pdf::{render_comparison_chart, render_report_pdf, MetricRow, ReportInput};

fn main() {
    let chart_svg = render_comparison_chart(
        "Spend vs. Conversions",
        &[
            ("Spend".to_string(), 1000.0, 1200.0),
            ("Conversions".to_string(), 40.0, 55.0),
            ("Clicks".to_string(), 2100.0, 1950.0),
        ],
    )
    .unwrap();

    let input = ReportInput {
        agency_name: "Acme Growth Partners".to_string(),
        client_name: "Bluebird Coffee Co.".to_string(),
        period_label: "August 1 - August 31, 2026".to_string(),
        brand_primary_color: "#4F46E5".to_string(),
        brand_secondary_color: "#111827".to_string(),
        intro_blurb: "Here is your monthly performance report for Bluebird Coffee Co. This month's data spans all connected ad platforms.".to_string(),
        ai_summary: "Overall performance improved this month, with spend increasing 20% to $1,200 while conversions grew a faster 37.5% to 55, indicating improved efficiency. Clicks declined slightly by 7.1% to 1,950, suggesting ad fatigue on some creatives worth refreshing. The biggest win was conversion volume, which outpaced the spend increase and lowered cost per conversion. The area of concern is the softening click volume, which merits a creative refresh next month.".to_string(),
        ai_summary_was_edited: false,
        metrics: vec![
            MetricRow { label: "Impressions".into(), current: "184,203".into(), previous: "171,004".into(), change: "+7.7%".into() },
            MetricRow { label: "Clicks".into(), current: "1,950".into(), previous: "2,100".into(), change: "-7.1%".into() },
            MetricRow { label: "Spend".into(), current: "$1,200.00".into(), previous: "$1,000.00".into(), change: "+20.0%".into() },
            MetricRow { label: "Conversions".into(), current: "55".into(), previous: "40".into(), change: "+37.5%".into() },
            MetricRow { label: "Revenue".into(), current: "$6,050.00".into(), previous: "$4,200.00".into(), change: "+44.0%".into() },
        ],
        logo_asset: None,
        chart_asset: Some("chart.svg".to_string()),
    };

    let pdf_bytes = render_report_pdf(&input, None, Some(("chart.svg".to_string(), chart_svg))).unwrap();
    std::fs::write("sample_report.pdf", pdf_bytes).unwrap();
    println!("wrote sample_report.pdf");
}
