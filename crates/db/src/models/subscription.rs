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
    pub current_period_start: Option<DateTime<Utc>>,
    pub current_period_end: Option<DateTime<Utc>>,
    pub cancel_at_period_end: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// The column list shared by every read of this table.
macro_rules! subscription_columns {
    ($where:expr) => {
        concat!(
            "select id, user_id, stripe_subscription_id, stripe_price_id, status, ",
            "current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at ",
            "from subscriptions where ",
            $where
        )
    };
}

impl Subscription {
    pub async fn find_by_user_id(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Option<Subscription>, sqlx::Error> {
        sqlx::query_as::<_, Subscription>(subscription_columns!("user_id = $1"))
            .bind(user_id)
            .fetch_optional(pool)
            .await
    }

    pub async fn find_by_stripe_subscription_id(
        pool: &PgPool,
        stripe_subscription_id: &str,
    ) -> Result<Option<Subscription>, sqlx::Error> {
        sqlx::query_as::<_, Subscription>(subscription_columns!("stripe_subscription_id = $1"))
            .bind(stripe_subscription_id)
            .fetch_optional(pool)
            .await
    }

    /// Idempotent upsert driven by Stripe webhook events — Stripe may deliver
    /// the same event more than once, so this must be safe to call twice.
    #[allow(clippy::too_many_arguments)]
    pub async fn upsert(
        pool: &PgPool,
        user_id: Uuid,
        stripe_subscription_id: &str,
        stripe_price_id: Option<&str>,
        status: &str,
        current_period_start: Option<DateTime<Utc>>,
        current_period_end: Option<DateTime<Utc>>,
        cancel_at_period_end: bool,
    ) -> Result<Subscription, sqlx::Error> {
        sqlx::query_as::<_, Subscription>(
            r#"
            insert into subscriptions
                (user_id, stripe_subscription_id, stripe_price_id, status,
                 current_period_start, current_period_end, cancel_at_period_end)
            values ($1, $2, $3, $4, $5, $6, $7)
            on conflict (user_id) do update set
                stripe_subscription_id = excluded.stripe_subscription_id,
                stripe_price_id = excluded.stripe_price_id,
                status = excluded.status,
                current_period_start = excluded.current_period_start,
                current_period_end = excluded.current_period_end,
                cancel_at_period_end = excluded.cancel_at_period_end,
                updated_at = now()
            returning id, user_id, stripe_subscription_id, stripe_price_id, status,
                      current_period_start, current_period_end, cancel_at_period_end,
                      created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind(stripe_subscription_id)
        .bind(stripe_price_id)
        .bind(status)
        .bind(current_period_start)
        .bind(current_period_end)
        .bind(cancel_at_period_end)
        .fetch_one(pool)
        .await
    }

    /// Status-only check: Stripe considers this subscription in good standing.
    /// Does NOT guarantee the paid window still covers *now* — use
    /// [`Self::is_currently_valid`] for that.
    pub fn is_active(&self) -> bool {
        matches!(self.status.as_str(), "active" | "trialing")
    }

    /// Full validation used for gating paid features: the subscription must be
    /// in good standing *and* the request must fall inside the period that was
    /// actually paid for. An `active` status whose `current_period_end` has
    /// slipped past (or whose Stripe period data is missing) fails here — the
    /// next `invoice.payment_succeeded` / `subscription.updated` webhook moves
    /// the window forward and this flips back to true.
    pub fn is_currently_valid(&self) -> bool {
        if !self.is_active() {
            return false;
        }
        match self.current_period_end {
            // A paid window that hasn't ended (now is before its end). The
            // period start is recorded for display/audit but doesn't gate:
            // Stripe can report a start slightly in the future on renewals.
            Some(end) => Utc::now() < end,
            // Missing period data means we can't prove payment covers now.
            None => false,
        }
    }
}
