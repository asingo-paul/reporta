use std::str::FromStr;

use chrono::{DateTime, Utc};
use reporta_db::models::{Subscription, User};
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
        let success_url = format!("{}/app/billing?checkout=success", self.frontend_base_url);
        let cancel_url = format!("{}/app/billing?checkout=cancelled", self.frontend_base_url);
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
        let return_url = format!("{}/app/billing", self.frontend_base_url);

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
    pub async fn apply_event(&self, pool: &PgPool, event: Event) -> Result<(), BillingError> {
        match event.type_ {
            EventType::CustomerSubscriptionCreated
            | EventType::CustomerSubscriptionUpdated
            | EventType::CustomerSubscriptionDeleted => {
                if let EventObject::Subscription(sub) = event.data.object {
                    let customer_id = match &sub.customer {
                        Expandable::Id(id) => id.to_string(),
                        Expandable::Object(c) => c.id.to_string(),
                    };
                    let Some(user) = User::find_by_stripe_customer_id(pool, &customer_id).await? else {
                        tracing::warn!(customer_id, "subscription webhook for unknown Stripe customer");
                        return Ok(());
                    };
                    let price_id = sub.items.data.first().and_then(|item| item.price.as_ref()).map(|p| p.id.to_string());
                    let current_period_end: Option<DateTime<Utc>> =
                        DateTime::from_timestamp(sub.current_period_end, 0);

                    Subscription::upsert(
                        pool,
                        user.id,
                        sub.id.as_str(),
                        price_id.as_deref(),
                        sub.status.as_str(),
                        current_period_end,
                        sub.cancel_at_period_end,
                    )
                    .await?;
                }
            }
            _ => {
                tracing::debug!(event_type = ?event.type_, "unhandled Stripe webhook event");
            }
        }
        Ok(())
    }
}
