use serde::{Deserialize, Serialize};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(thiserror::Error, Debug)]
pub enum InsightsError {
    #[error("Anthropic API key is not configured")]
    NotConfigured,
    #[error("Anthropic API request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Anthropic API returned an error ({status}): {body}")]
    ApiError { status: u16, body: String },
    #[error("Anthropic API response had no text content")]
    EmptyResponse,
}

#[derive(Serialize)]
struct MessageParam<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct MessagesRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    system: &'a str,
    messages: Vec<MessageParam<'a>>,
}

#[derive(Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    kind: String,
    text: Option<String>,
}

#[derive(Deserialize)]
struct MessagesResponse {
    content: Vec<ContentBlock>,
}

/// Thin client for Anthropic's Messages API. Deliberately minimal — this
/// product needs exactly one call shape (a short, non-streaming text
/// completion), so it doesn't pull in tool use, streaming, or caching.
pub struct ClaudeClient {
    http: reqwest::Client,
    api_key: String,
    model: String,
}

impl ClaudeClient {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            api_key,
            model,
        }
    }

    pub async fn complete(&self, system_prompt: &str, user_message: &str) -> Result<String, InsightsError> {
        let body = MessagesRequest {
            model: &self.model,
            max_tokens: 1024,
            system: system_prompt,
            messages: vec![MessageParam {
                role: "user",
                content: user_message,
            }],
        };

        let resp = self
            .http
            .post(ANTHROPIC_API_URL)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(InsightsError::ApiError {
                status: status.as_u16(),
                body,
            });
        }

        let parsed: MessagesResponse = resp.json().await?;
        parsed
            .content
            .into_iter()
            .find(|b| b.kind == "text")
            .and_then(|b| b.text)
            .ok_or(InsightsError::EmptyResponse)
    }
}
