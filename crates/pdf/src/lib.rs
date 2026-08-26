pub mod charts;
pub mod template;
pub mod world;

use std::collections::HashMap;

use typst_layout::PagedDocument;
use typst_pdf::PdfOptions;

pub use charts::render_comparison_chart;
pub use template::{build_report_source, MetricRow, ReportInput};
use world::ReportWorld;

#[derive(thiserror::Error, Debug)]
pub enum PdfError {
    #[error("chart rendering failed: {0}")]
    Chart(String),
    #[error("report layout failed: {0}")]
    Compile(String),
    #[error("PDF export failed: {0}")]
    Export(String),
}

/// Renders one report to a finished PDF: builds the Typst source, registers
/// the logo/chart assets in an in-memory `World`, compiles, and exports.
pub fn render_report_pdf(
    input: &ReportInput,
    logo_bytes: Option<(String, Vec<u8>)>,
    chart_svg: Option<(String, String)>,
) -> Result<Vec<u8>, PdfError> {
    let source = build_report_source(input);

    let mut assets: HashMap<String, Vec<u8>> = HashMap::new();
    if let Some((name, bytes)) = logo_bytes {
        assets.insert(name, bytes);
    }
    if let Some((name, svg)) = chart_svg {
        assets.insert(name, svg.into_bytes());
    }

    let world = ReportWorld::new(source, assets);

    let warned = typst::compile::<PagedDocument>(&world);
    let document = warned.output.map_err(|diags| {
        let joined = diags
            .iter()
            .map(|d| d.message.to_string())
            .collect::<Vec<_>>()
            .join("; ");
        PdfError::Compile(joined)
    })?;

    typst_pdf::pdf(&document, &PdfOptions::default()).map_err(|diags| {
        let joined = diags
            .iter()
            .map(|d| d.message.to_string())
            .collect::<Vec<_>>()
            .join("; ");
        PdfError::Export(joined)
    })
}
