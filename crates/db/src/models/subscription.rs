use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct Subscription {
    pub id: Uuid,
    pub user_id: Uuid,
    pub stripe_subscription_id: Option<String>,
    pub stripe_price_id: Option<String>,
    pub status: String,
    pub current_period_end: Option<DateTime<Utc>>,
    pub cancel_at_period_end: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Subscription {
    pub async fn find_by_user_id(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Option<Subscription>, sqlx::Error> {
        sqlx::query_as::<_, Subscription>(
            r#"select id, user_id, stripe_subscription_id, stripe_price_id, status,
                      current_period_end, cancel_at_period_end, created_at, updated_at
               from subscriptions where user_id = $1"#,
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
    }

    pub async fn find_by_stripe_subscription_id(
        pool: &PgPool,
        stripe_subscription_id: &str,
    ) -> Result<Option<Subscription>, sqlx::Error> {
        sqlx::query_as::<_, Subscription>(
            r#"select id, user_id, stripe_subscription_id, stripe_price_id, status,
                      current_period_end, cancel_at_period_end, created_at, updated_at
               from subscriptions where stripe_subscription_id = $1"#,
        )
        .bind(stripe_subscription_id)
        .fetch_optional(pool)
        .await
    }

    /// Idempotent upsert driven by Stripe webhook events — Stripe may deliver
    /// the same event more than once, so this must be safe to call twice.
    pub async fn upsert(
        pool: &PgPool,
        user_id: Uuid,
        stripe_subscription_id: &str,
        stripe_price_id: Option<&str>,
        status: &str,
        current_period_end: Option<DateTime<Utc>>,
        cancel_at_period_end: bool,
    ) -> Result<Subscription, sqlx::Error> {
        sqlx::query_as::<_, Subscription>(
            r#"
            insert into subscriptions
                (user_id, stripe_subscription_id, stripe_price_id, status, current_period_end, cancel_at_period_end)
            values ($1, $2, $3, $4, $5, $6)
            on conflict (user_id) do update set
                stripe_subscription_id = excluded.stripe_subscription_id,
                stripe_price_id = excluded.stripe_price_id,
                status = excluded.status,
                current_period_end = excluded.current_period_end,
                cancel_at_period_end = excluded.cancel_at_period_end,
                updated_at = now()
            returning id, user_id, stripe_subscription_id, stripe_price_id, status,
                      current_period_end, cancel_at_period_end, created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind(stripe_subscription_id)
        .bind(stripe_price_id)
        .bind(status)
        .bind(current_period_end)
        .bind(cancel_at_period_end)
        .fetch_one(pool)
        .await
    }

    pub fn is_active(&self) -> bool {
        matches!(self.status.as_str(), "active" | "trialing")
    }
}
