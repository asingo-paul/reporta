pub mod claude;
pub mod engine;
pub mod guard;
pub mod prompt;

pub use claude::{ClaudeClient, InsightsError};
pub use engine::{GeneratedSummary, InsightsEngine};
pub use prompt::MetricPoint;
