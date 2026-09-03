use reporta_common::BreakdownSection;
use reporta_pdf::{render_comparison_chart, render_report_pdf, MetricRow, ReportInput};

fn main() {
    let chart_svg = render_comparison_chart(
        "This Period vs. Previous Period",
        &[
            ("Sessions".to_string(), 8120.0, 9430.0),
            ("Total Users".to_string(), 6240.0, 7180.0),
            ("Page Views".to_string(), 19850.0, 22540.0),
        ],
    )
    .unwrap();

    let input = ReportInput {
        agency_name: "Acme Growth Partners".to_string(),
        client_name: "Bluebird Coffee Co.".to_string(),
        period_label: "August 1 - August 31, 2026".to_string(),
        brand_primary_color: "#4F46E5".to_string(),
        brand_secondary_color: "#111827".to_string(),
        intro_blurb: "Here is your monthly website performance report for Bluebird Coffee Co.".to_string(),
        ai_summary: "Traffic grew across the board this month, with sessions up 16.1% to 9,430 and total users up 15.1% to 7,180. Page views rose 13.6% to 22,540, keeping pace with the larger audience. Engagement rate held steady at 61.20%, indicating the additional visitors were similarly qualified. The one area to watch is average engagement time, which slipped 4.8%, suggesting newer visitors are spending slightly less time on site.".to_string(),
        ai_recommendations: vec!["Keep the current creative rotation; refresh the lowest-CTR ad set.".to_string(), "Reallocate budget toward the best-performing channel.".to_string()],
        ai_conclusion: "The account is trending up; focus next period on protecting the efficiency gain.".to_string(),
        ai_summary_was_edited: false,
        ai_summary_is_fallback: false,
        sources: vec!["Google Analytics 4".into()],
        breakdowns: vec![{
            let mut s = BreakdownSection::new(
                "Sessions by channel (this period vs previous)",
                vec!["Channel", "Sessions", "Change", "Engaged", "Key events"],
            );
            s.push_row(vec!["Organic Search".into(), "4,120".into(), "+22.1%".into(), "2,980".into(), "61".into()]);
            s.push_row(vec!["Direct".into(), "2,540".into(), "+4.0%".into(), "1,610".into(), "28".into()]);
            s.push_row(vec!["Paid Social".into(), "1,880".into(), "+31.5%".into(), "900".into(), "22".into()]);
            s.push_row(vec!["Referral".into(), "610".into(), "-12.0%".into(), "410".into(), "9".into()]);
            s
        }],
        metrics: vec![
            MetricRow { label: "Sessions".into(), current: "9,430".into(), previous: "8,120".into(), change: "+16.1%".into(), delta_pct: Some(16.1) },
            MetricRow { label: "Total Users".into(), current: "7,180".into(), previous: "6,240".into(), change: "+15.1%".into(), delta_pct: Some(15.1) },
            MetricRow { label: "New Users".into(), current: "4,610".into(), previous: "3,980".into(), change: "+15.8%".into(), delta_pct: Some(15.8) },
            MetricRow { label: "Page Views".into(), current: "22,540".into(), previous: "19,850".into(), change: "+13.6%".into(), delta_pct: Some(13.6) },
            MetricRow { label: "Engagement Rate".into(), current: "61.20%".into(), previous: "61.05%".into(), change: "+0.2%".into(), delta_pct: Some(0.2) },
            MetricRow { label: "Avg. Engagement Time".into(), current: "2m 41s".into(), previous: "2m 49s".into(), change: "-4.8%".into(), delta_pct: Some(-4.8) },
        ],
        logo_asset: None,
        chart_asset: Some("chart.svg".to_string()),
    };

    let pdf_bytes = render_report_pdf(&input, None, Some(("chart.svg".to_string(), chart_svg))).unwrap();
    std::fs::write("sample_report.pdf", pdf_bytes).unwrap();
    println!("wrote sample_report.pdf");
}
