use plotters::prelude::*;

use crate::PdfError;

/// Renders a simple grouped bar chart (this period vs. previous period) for
/// up to a handful of metrics, as an SVG string that gets embedded directly
/// into the Typst report as a virtual asset file.
pub fn render_comparison_chart(
    title: &str,
    bars: &[(String, f64, f64)],
) -> Result<String, PdfError> {
    let mut svg = String::new();
    let width = 900u32;
    let height = 420u32;

    {
        let root = SVGBackend::with_string(&mut svg, (width, height)).into_drawing_area();
        root.fill(&WHITE).map_err(|e| PdfError::Chart(e.to_string()))?;

        let max_value = bars
            .iter()
            .flat_map(|(_, a, b)| [*a, *b])
            .fold(0.0_f64, f64::max)
            .max(1.0)
            * 1.15;
        let x_max = (bars.len() * 2) as f64;

        let mut chart = ChartBuilder::on(&root)
            .margin(20)
            .caption(title, ("sans-serif", 24))
            .x_label_area_size(30)
            .y_label_area_size(60)
            .build_cartesian_2d(0.0..x_max, 0.0..max_value)
            .map_err(|e| PdfError::Chart(e.to_string()))?;

        // The x-axis has no natural numeric meaning (it's just bar-group
        // slots), so the automatic tick-label placement plotters would use
        // for a continuous range doesn't line up with bar centers. Disable
        // it and draw each metric's label by hand, positioned exactly under
        // its bar pair.
        chart
            .configure_mesh()
            .disable_x_mesh()
            .disable_x_axis()
            .y_desc("Value")
            .draw()
            .map_err(|e| PdfError::Chart(e.to_string()))?;

        let previous_color = RGBColor(0x9C, 0xA3, 0xAF);
        let current_color = RGBColor(0x4F, 0x46, 0xE5);
        let label_style = ("sans-serif", 14).into_font().color(&BLACK.mix(0.85));

        for (i, (label, previous, current)) in bars.iter().enumerate() {
            let base = (i * 2) as f64;
            chart
                .draw_series(std::iter::once(Rectangle::new(
                    [(base, 0.0), (base + 1.0, *previous)],
                    previous_color.filled(),
                )))
                .map_err(|e| PdfError::Chart(e.to_string()))?;
            chart
                .draw_series(std::iter::once(Rectangle::new(
                    [(base + 1.0, 0.0), (base + 2.0, *current)],
                    current_color.filled(),
                )))
                .map_err(|e| PdfError::Chart(e.to_string()))?;

            let (px, py) = chart.plotting_area().map_coordinate(&(base + 1.0, 0.0));
            let text_width = label.len() as i32 * 4;
            root.draw_text(label, &label_style, (px - text_width, py + 8))
                .map_err(|e| PdfError::Chart(e.to_string()))?;
        }

        root.present().map_err(|e| PdfError::Chart(e.to_string()))?;
    }

    Ok(svg)
}
