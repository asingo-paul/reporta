use serde::{Deserialize, Serialize};

/// Every provider below speaks the same Chat Completions protocol; the one
/// actually used is chosen at runtime via `OPENAI_BASE_URL` (see Config).

#[derive(thiserror::Error, Debug)]
pub enum InsightsError {
    #[error("no LLM API key is configured (set OPENAI_API_KEY in .env)")]
    NotConfigured,
    #[error("LLM request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("LLM API returned an error ({status}): {body}")]
    ApiError { status: u16, body: String },
    #[error("LLM response had no message content")]
    EmptyResponse,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    /// Uses the newer `max_completion_tokens` field rather than the legacy
    /// `max_tokens`, which some newer models (the reasoning variants) reject.
    max_completion_tokens: u32,
    messages: Vec<ChatMessage<'a>>,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: Option<String>,
}

/// Thin client speaking the OpenAI Chat Completions protocol. Deliberately
/// minimal — this product needs exactly one call shape (a short, non-streaming
/// text completion). The endpoint is configurable, so besides OpenAI itself it
/// also works with any OpenAI-compatible provider such as Google's Gemini
/// compatibility endpoint or Groq (both of which have usable free tiers).
pub struct OpenAIClient {
    http: reqwest::Client,
    api_key: String,
    model: String,
    endpoint: String,
}

impl OpenAIClient {
    /// `endpoint` is the full chat-completions URL, e.g.
    /// `https://api.openai.com/v1/chat/completions` or
    /// `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`.
    pub fn new(api_key: String, model: String, endpoint: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            api_key,
            model,
            endpoint,
        }
    }

    pub async fn complete(&self, system_prompt: &str, user_message: &str) -> Result<String, InsightsError> {
        let body = ChatCompletionRequest {
            model: &self.model,
            max_completion_tokens: 1024,
            messages: vec![
                ChatMessage {
                    role: "system",
                    content: system_prompt,
                },
                ChatMessage {
                    role: "user",
                    content: user_message,
                },
            ],
        };

        let resp = self
            .http
            .post(&self.endpoint)
            .bearer_auth(&self.api_key)
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

        let parsed: ChatCompletionResponse = resp.json().await?;
        parsed
            .choices
            .into_iter()
            .next()
            .and_then(|c| c.message.content)
            .filter(|c| !c.trim().is_empty())
            .ok_or(InsightsError::EmptyResponse)
    }
}