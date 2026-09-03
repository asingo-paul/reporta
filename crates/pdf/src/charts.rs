use plotters::prelude::*;
use plotters::style::text_anchor::{HPos, Pos, VPos};

use crate::PdfError;

const PREVIOUS_COLOR: RGBColor = RGBColor(0x9C, 0xA3, 0xAF);
const CURRENT_COLOR: RGBColor = RGBColor(0x4F, 0x46, 0xE5);

/// Renders a grouped bar chart (previous period vs. this period) for a handful
/// of comparable metrics, as an SVG string embedded into the Typst report.
/// Each group is `[label]` with two labelled bars; a legend names the two
/// series. Callers pre-filter `bars` to metrics of comparable magnitude so a
/// single shared y-scale stays readable.
pub fn render_comparison_chart(
    title: &str,
    bars: &[(String, f64, f64)],
) -> Result<String, PdfError> {
    let mut svg = String::new();
    let width = 900u32;
    let height = 400u32;

    if bars.is_empty() {
        // Nothing to plot — return a blank canvas rather than erroring; the
        // caller decides whether to include the section at all.
        {
            let root = SVGBackend::with_string(&mut svg, (width, height)).into_drawing_area();
            root.fill(&WHITE).map_err(|e| PdfError::Chart(e.to_string()))?;
            root.present().map_err(|e| PdfError::Chart(e.to_string()))?;
        }
        return Ok(svg);
    }

    {
        let root = SVGBackend::with_string(&mut svg, (width, height)).into_drawing_area();
        root.fill(&WHITE).map_err(|e| PdfError::Chart(e.to_string()))?;

        let max_value = bars
            .iter()
            .flat_map(|(_, a, b)| [*a, *b])
            .fold(0.0_f64, f64::max)
            .max(1.0)
            * 1.3;

        // Each metric group is 3 x-units wide: two 1-unit bars + a 1-unit gap.
        let group_span = 3.0_f64;
        let x_max = bars.len() as f64 * group_span;

        let mut chart = ChartBuilder::on(&root)
            .margin(20)
            .caption(title, ("sans-serif", 24))
            .x_label_area_size(46)
            .y_label_area_size(70)
            .build_cartesian_2d(0.0..x_max, 0.0..max_value)
            .map_err(|e| PdfError::Chart(e.to_string()))?;

        // The x-axis slots have no numeric meaning; labels are drawn by hand,
        // centred under each group.
        chart
            .configure_mesh()
            .disable_x_mesh()
            .disable_x_axis()
            .y_labels(5)
            .max_light_lines(1)
            .y_desc("Value")
            .y_label_formatter(&|v: &f64| compact_number(*v))
            .axis_desc_style(("sans-serif", 15))
            .label_style(("sans-serif", 13))
            .draw()
            .map_err(|e| PdfError::Chart(e.to_string()))?;

        // Two series (one legend entry each).
        chart
            .draw_series(bars.iter().enumerate().map(|(i, (_, prev, _))| {
                let base = i as f64 * group_span;
                Rectangle::new([(base + 0.1, 0.0), (base + 1.0, *prev)], PREVIOUS_COLOR.filled())
            }))
            .map_err(|e| PdfError::Chart(e.to_string()))?
            .label("Previous period")
            .legend(|(x, y)| Rectangle::new([(x, y - 6), (x + 12, y + 6)], PREVIOUS_COLOR.filled()));

        chart
            .draw_series(bars.iter().enumerate().map(|(i, (_, _, curr))| {
                let base = i as f64 * group_span;
                Rectangle::new([(base + 1.0, 0.0), (base + 1.9, *curr)], CURRENT_COLOR.filled())
            }))
            .map_err(|e| PdfError::Chart(e.to_string()))?
            .label("This period")
            .legend(|(x, y)| Rectangle::new([(x, y - 6), (x + 12, y + 6)], CURRENT_COLOR.filled()));

        chart
            .configure_series_labels()
            .position(SeriesLabelPosition::UpperRight)
            .background_style(WHITE.mix(0.9))
            .border_style(RGBColor(0xD1, 0xD5, 0xDB))
            .label_font(("sans-serif", 13))
            .draw()
            .map_err(|e| PdfError::Chart(e.to_string()))?;

        // Value labels above each bar + the metric label centred under the group.
        // `map_coordinate` on the plotting area yields backend (root) pixels, so
        // the text itself is drawn on `root`.
        let value_style = ("sans-serif", 12)
            .into_font()
            .color(&BLACK.mix(0.75))
            .pos(Pos::new(HPos::Center, VPos::Bottom));
        let label_style = ("sans-serif", 14)
            .into_font()
            .color(&BLACK.mix(0.85))
            .pos(Pos::new(HPos::Center, VPos::Top));

        let mut marks: Vec<(String, (i32, i32), bool)> = Vec::new();
        for (i, (label, prev, curr)) in bars.iter().enumerate() {
            let base = i as f64 * group_span;
            for (center_x, value) in [(base + 0.55, *prev), (base + 1.45, *curr)] {
                let (px, py) = chart.plotting_area().map_coordinate(&(center_x, value));
                marks.push((compact_number(value), (px, py - 4), true));
            }
            let (lx, ly) = chart.plotting_area().map_coordinate(&(base + 1.0, 0.0));
            marks.push((label.clone(), (lx, ly + 8), false));
        }
        for (text, pos, is_value) in marks {
            let style = if is_value { &value_style } else { &label_style };
            root.draw_text(&text, style, pos).map_err(|e| PdfError::Chart(e.to_string()))?;
        }

        root.present().map_err(|e| PdfError::Chart(e.to_string()))?;
    }

    Ok(svg)
}

/// `1234567.0` -> `"1.2M"`, `22540.0` -> `"22,540"`, `3.6` -> `"3.6"`.
fn compact_number(v: f64) -> String {
    let a = v.abs();
    if a >= 1_000_000.0 {
        format!("{:.1}M", v / 1_000_000.0)
    } else if a >= 1_000.0 {
        let n = v.round() as i64;
        let s = n.abs().to_string();
        let mut out = String::new();
        for (i, c) in s.chars().enumerate() {
            if i > 0 && (s.len() - i) % 3 == 0 {
                out.push(',');
            }
            out.push(c);
        }
        if n < 0 {
            format!("-{out}")
        } else {
            out
        }
    } else if a >= 1.0 || a == 0.0 {
        format!("{v:.0}")
    } else {
        format!("{v:.1}")
    }
}
