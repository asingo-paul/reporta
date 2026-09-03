use std::str::FromStr;

use chrono::DateTime;
use reporta_db::models::{AuditLog, Subscription as LocalSubscription, User};
use sqlx::PgPool;
use stripe::{
    BillingPortalSession, CheckoutSession, CheckoutSessionMode, Client, CreateBillingPortalSession,
    CreateCheckoutSession, CreateCheckoutSessionLineItems, CreateCustomer, Customer, CustomerId, Event,
    EventObject, EventType, Expandable,
};

use crate::error::BillingError;

pub struct BillingService {
    client: Client,
    price_id: String,
    frontend_base_url: String,
    webhook_secret: String,
}

impl BillingService {
    pub fn new(secret_key: String, price_id: String, frontend_base_url: String, webhook_secret: String) -> Self {
        Self {
            client: Client::new(secret_key),
            price_id,
            frontend_base_url,
            webhook_secret,
        }
    }

    async fn ensure_stripe_customer(&self, pool: &PgPool, user: &User) -> Result<CustomerId, BillingError> {
        if let Some(id) = &user.stripe_customer_id {
            return CustomerId::from_str(id).map_err(|_| BillingError::MissingField("stripe_customer_id"));
        }

        let customer = Customer::create(
            &self.client,
            CreateCustomer {
                email: Some(&user.email),
                name: Some(&user.name),
                metadata: Some(std::collections::HashMap::from([(
                    "reporta_user_id".to_string(),
                    user.id.to_string(),
                )])),
                ..Default::default()
            },
        )
        .await?;

        User::set_stripe_customer_id(pool, user.id, &customer.id.to_string()).await?;
        Ok(customer.id)
    }

    /// Creates a Stripe Checkout Session for the $29/mo subscription (Step:
    /// "Sign-up/Login with Stripe payment" in the spec's MVP scope). Returns
    /// the hosted checkout URL to redirect the browser to.
    pub async fn create_checkout_session(&self, pool: &PgPool, user: &User) -> Result<String, BillingError> {
        let customer_id = self.ensure_stripe_customer(pool, user).await?;
        let success_url = format!("{}/settings?tab=billing&checkout=success", self.frontend_base_url);
        let cancel_url = format!("{}/settings?tab=billing&checkout=cancelled", self.frontend_base_url);
        let client_reference_id = user.id.to_string();

        let mut params = CreateCheckoutSession::new();
        params.mode = Some(CheckoutSessionMode::Subscription);
        params.customer = Some(customer_id);
        params.client_reference_id = Some(&client_reference_id);
        params.success_url = Some(&success_url);
        params.cancel_url = Some(&cancel_url);
        params.line_items = Some(vec![CreateCheckoutSessionLineItems {
            price: Some(self.price_id.clone()),
            quantity: Some(1),
            ..Default::default()
        }]);

        let session = CheckoutSession::create(&self.client, params).await?;
        session.url.ok_or(BillingError::MissingField("checkout_session.url"))
    }

    /// Creates a Stripe Customer Portal session so a user can manage/cancel
    /// their subscription without the agency needing to build billing UI.
    pub async fn create_portal_session(&self, pool: &PgPool, user: &User) -> Result<String, BillingError> {
        let customer_id = self.ensure_stripe_customer(pool, user).await?;
        let return_url = format!("{}/settings?tab=billing", self.frontend_base_url);

        let mut params = CreateBillingPortalSession::new(customer_id);
        params.return_url = Some(&return_url);
        let session = BillingPortalSession::create(&self.client, params).await?;
        Ok(session.url)
    }

    /// Verifies a webhook's `Stripe-Signature` header against the configured
    /// endpoint secret. This must be called on every webhook request before
    /// trusting its payload — otherwise anyone could POST a fake
    /// "subscription active" event.
    pub fn verify_webhook(&self, payload: &str, signature: &str) -> Result<Event, BillingError> {
        stripe::Webhook::construct_event(payload, signature, &self.webhook_secret)
            .map_err(|e| BillingError::InvalidWebhookSignature(e.to_string()))
    }

    /// Applies a verified webhook event to local state. Idempotent: Stripe
    /// may redeliver the same event, and `Subscription::upsert` is a plain
    /// upsert keyed on `user_id`, so replaying an event is a no-op beyond the
    /// first application.
    ///
    /// Payment completion (`checkout.session.completed`,
    /// `invoice.payment_succeeded`) is treated as the authoritative moment:
    /// we re-fetch the subscription from Stripe, verify it is actually in
    /// good standing, and record the exact paid window (period start → end)
    /// locally so the rest of the app can validate against it.
    pub async fn apply_event(&self, pool: &PgPool, event: Event) -> Result<(), BillingError> {
        match event.type_ {
            EventType::CustomerSubscriptionCreated
            | EventType::CustomerSubscriptionUpdated
            | EventType::CustomerSubscriptionDeleted => {
                if let EventObject::Subscription(sub) = event.data.object {
                    self.sync_subscription_event(pool, &sub).await?;
                    if event.type_ == EventType::CustomerSubscriptionDeleted {
                        if let Some(user) =
                            self.resolve_user(pool, &expandable_customer_id(&sub.customer), None).await?
                        {
                            audit_event(
                                pool,
                                Some(user.id),
                                "billing.subscription_ended",
                                serde_json::json!({
                                    "stripe_subscription_id": sub.id.as_str(),
                                    "status": sub.status.as_str(),
                                }),
                            );
                        }
                    }
                }
            }

            // A payment just completed — the initial subscription checkout.
            // Fetch the authoritative subscription, verify it's active, and
            // record the paid period locally.
            EventType::CheckoutSessionCompleted => {
                if let EventObject::CheckoutSession(session) = event.data.object {
                    // The session carries the user id we stamped at checkout
                    // time — a fallback when the customer lookup comes up
                    // empty (e.g. `stripe_customer_id` not yet persisted).
                    let fallback_user = session
                        .client_reference_id
                        .as_deref()
                        .and_then(|s| uuid::Uuid::parse_str(s).ok());

                    let Some(sub) =
                        self.fetch_subscription(session.subscription.as_ref()).await?
                    else {
                        tracing::warn!(
                            session_id = %session.id,
                            "checkout.session.completed without a subscription (mode was not `subscription`?)"
                        );
                        return Ok(());
                    };

                    let user = self
                        .resolve_user(pool, &customer_id(&session.customer), fallback_user)
                        .await?;
                    self.record_completed_payment(pool, user.as_ref(), &sub, "initial").await?;
                }
            }
            // A renewal payment succeeded — same validation path as the
            // initial checkout, so the local paid window rolls forward the
            // moment the money lands.
            EventType::InvoicePaymentSucceeded => {
                if let EventObject::Invoice(invoice) = event.data.object {
                    let Some(sub) = self.fetch_subscription(invoice.subscription.as_ref()).await?
                    else {
                        // One-off (non-subscription) invoice — nothing to sync.
                        tracing::debug!(
                            invoice_id = %invoice.id,
                            "payment succeeded for non-subscription invoice"
                        );
                        return Ok(());
                    };

                    let user = self.resolve_user(pool, &customer_id(&invoice.customer), None).await?;
                    self.record_completed_payment(pool, user.as_ref(), &sub, "renewal").await?;
                }
            }
            // A renewal payment failed — sync the (now `past_due`/`unpaid`)
            // state locally so paid-feature gating reacts immediately.
            EventType::InvoicePaymentFailed => {
                if let EventObject::Invoice(invoice) = event.data.object {
                    let Some(sub) = self.fetch_subscription(invoice.subscription.as_ref()).await?
                    else {
                        tracing::debug!(invoice_id = %invoice.id, "payment failed for non-subscription invoice");
                        return Ok(());
                    };

                    let user = self.resolve_user(pool, &customer_id(&invoice.customer), None).await?;
                    let local = self.sync_subscription(pool, user.as_ref(), &sub).await?;
                    tracing::warn!(
                        invoice_id = %invoice.id,
                        status = sub.status.as_str(),
                        "subscription payment failed"
                    );
                    audit_event(
                        pool,
                        Some(local.user_id),
                        "billing.payment_failed",
                        serde_json::json!({
                            "stripe_subscription_id": sub.id.as_str(),
                            "status": sub.status.as_str(),
                            "attempt_count": invoice.attempt_count,
                        }),
                    );
                }
            }
            _ => {
                tracing::debug!(event_type = ?event.type_, "unhandled Stripe webhook event");
            }
        }
        Ok(())
    }

    /// The shared "payment completed" path for checkout completions and
    /// successful renewal invoices: resolve the user, verify the subscription
    /// is in good standing, persist the exact paid window, and log both to
    /// tracing and the audit trail.
    async fn record_completed_payment(
        &self,
        pool: &PgPool,
        user: Option<&User>,
        sub: &stripe::Subscription,
        kind: &str,
    ) -> Result<(), BillingError> {
        let Some(user) = user else {
            tracing::warn!(
                stripe_subscription_id = sub.id.as_str(),
                "payment completed for a Stripe customer not linked to any reporta user"
            );
            audit_event(
                pool,
                None,
                "billing.payment_unknown_customer",
                serde_json::json!({
                    "stripe_subscription_id": sub.id.as_str(),
                    "status": sub.status.as_str(),
                }),
            );
            return Ok(());
        };

        // Persist the subscription + paid period before validating, so the
        // local row always reflects what Stripe says — even when the status
        // is *not* good standing (e.g. `incomplete`), that's the truth the
        // rest of the app should see and gate on.
        let local = self.sync_subscription(pool, Some(user), sub).await?;

        let in_period = local.is_currently_valid();
        if !in_period {
            tracing::warn!(
                user_id = %user.id,
                stripe_subscription_id = sub.id.as_str(),
                status = sub.status.as_str(),
                "payment completed but subscription is not in an active, in-period state"
            );
        }

        audit_event(
            pool,
            Some(user.id),
            "billing.payment_completed",
            serde_json::json!({
                "kind": kind,
                "stripe_subscription_id": sub.id.as_str(),
                "status": sub.status.as_str(),
                "active": local.is_active(),
                "in_period": in_period,
                "period_start": local.current_period_start,
                "period_end": local.current_period_end,
            }),
        );
        Ok(())
    }

    /// Syncs a Stripe subscription object into the local row (status + the
    /// exact current paid window).
    async fn sync_subscription(
        &self,
        pool: &PgPool,
        user: Option<&User>,
        sub: &stripe::Subscription,
    ) -> Result<LocalSubscription, BillingError> {
        let Some(user) = user else {
            tracing::warn!(
                stripe_subscription_id = sub.id.as_str(),
                "cannot sync subscription without a linked reporta user"
            );
            return Err(BillingError::MissingField("reporta_user"));
        };
        let price_id =
            sub.items.data.first().and_then(|item| item.price.as_ref()).map(|p| p.id.to_string());
        let current_period_start = DateTime::from_timestamp(sub.current_period_start, 0);
        let current_period_end = DateTime::from_timestamp(sub.current_period_end, 0);

        LocalSubscription::upsert(
            pool,
            user.id,
            sub.id.as_str(),
            price_id.as_deref(),
            sub.status.as_str(),
            current_period_start,
            current_period_end,
            sub.cancel_at_period_end,
        )
        .await
        .map_err(BillingError::from)
    }

    /// Handles `customer.subscription.*` events. The user must already be
    /// linked (via `stripe_customer_id`); these events carry no fallback.
    async fn sync_subscription_event(
        &self,
        pool: &PgPool,
        sub: &stripe::Subscription,
    ) -> Result<(), BillingError> {
        let Some(user) = self.resolve_user(pool, &expandable_customer_id(&sub.customer), None).await? else {
            tracing::warn!(
                customer_id = expandable_customer_id(&sub.customer),
                "subscription webhook for unknown Stripe customer"
            );
            return Ok(());
        };
        self.sync_subscription(pool, Some(&user), sub).await?;
        Ok(())
    }

    /// Resolves our user from a Stripe customer id, optionally falling back
    /// to a user id hint (checkout's `client_reference_id`).
    async fn resolve_user(
        &self,
        pool: &PgPool,
        customer_id: &str,
        fallback_user_id: Option<uuid::Uuid>,
    ) -> Result<Option<User>, sqlx::Error> {
        if let Some(user) = User::find_by_stripe_customer_id(pool, customer_id).await? {
            return Ok(Some(user));
        }
        if let Some(user_id) = fallback_user_id {
            if let Some(user) = User::find_by_id(pool, user_id).await? {
                return Ok(Some(user));
            }
        }
        Ok(None)
    }

    /// Checkout sessions and invoices reference their subscription by id; we
    /// always re-fetch the full object so the status and period we record are
    /// authoritative rather than whatever snapshot the event carried.
    async fn fetch_subscription(
        &self,
        expandable: Option<&Expandable<stripe::Subscription>>,
    ) -> Result<Option<stripe::Subscription>, BillingError> {
        match expandable {
            None => Ok(None),
            Some(Expandable::Object(sub)) => Ok(Some((**sub).clone())),
            Some(Expandable::Id(id)) => {
                let sub = stripe::Subscription::retrieve(&self.client, id, &[]).await?;
                Ok(Some(sub))
            }
        }
    }

    /// Active reconciliation used right after a checkout completes: we don't
    /// wait for a webhook to land (they can lag, and don't reach localhost in
    /// dev) — instead we ask Stripe directly for this customer's most recent
    /// subscription and bring the local row up to date. This is what makes
    /// "your payment is confirmed" appear immediately rather than "still
    /// confirming".
    pub async fn sync_subscription_from_stripe(
        &self,
        pool: &PgPool,
        user: &User,
    ) -> Result<Option<LocalSubscription>, BillingError> {
        let Some(customer_id) = &user.stripe_customer_id else {
            return Ok(None);
        };

        let mut params = stripe::ListSubscriptions::new();
        params.customer = Some(
            CustomerId::from_str(customer_id)
                .map_err(|_| BillingError::MissingField("stripe_customer_id"))?,
        );
        params.limit = Some(10);

        let subs = stripe::Subscription::list(&self.client, &params).await?;

        // Prefer a subscription that is (or was recently) meaningful — the
        // list is newest-first, so pick the newest one that isn't an
        // arbitrary cancelled/old row. Subscriptions here are by construction
        // the single $29/mo line, so the first is normally correct.
        let sub = subs
            .data
            .into_iter()
            .max_by_key(|s| s.created);

        let Some(sub) = sub else {
            return Ok(None);
        };

        let local = self.sync_subscription(pool, Some(user), &sub).await?;
        Ok(Some(local))
    }
}

/// Extracts the customer id string from Stripe's `Expandable<Customer>`.
fn expandable_customer_id(customer: &Expandable<Customer>) -> String {
    match customer {
        Expandable::Id(id) => id.to_string(),
        Expandable::Object(c) => c.id.to_string(),
    }
}

/// Like [`expandable_customer_id`] but for the `Option<Expandable<Customer>>`
/// shape that CheckoutSessions and Invoices use (subscriptions use the bare
/// `Expandable` directly).
fn customer_id(customer: &Option<Expandable<Customer>>) -> String {
    customer.as_ref().map(expandable_customer_id).unwrap_or_default()
}

/// Best-effort audit write for billing events — same contract as the API
/// layer: a logging failure must never fail the (verified) webhook being
/// processed, and the `received` response must stay fast.
fn audit_event(pool: &PgPool, user_id: Option<uuid::Uuid>, action: &str, metadata: serde_json::Value) {
    let pool = pool.clone();
    let action = action.to_string();
    tokio::spawn(async move {
        if let Err(e) =
            AuditLog::record(&pool, user_id, &action, Some("billing"), None, metadata, None).await
        {
            tracing::warn!(error = ?e, action, "failed to write billing audit log");
        }
    });
}
