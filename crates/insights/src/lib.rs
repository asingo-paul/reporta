pub mod engine;
pub mod guard;
pub mod openai;
pub mod prompt;

pub use openai::{InsightsError, OpenAIClient};
pub use engine::{GeneratedSummary, InsightsEngine};
pub use prompt::MetricPoint;
