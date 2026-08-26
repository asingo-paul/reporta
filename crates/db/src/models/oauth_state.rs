use chrono::{DateTime, Utc};
use reporta_common::metrics::Provider;
use sqlx::PgPool;
use uuid::Uuid;

/// Short-lived, single-use record binding an OAuth CSRF `state` value to the
/// client/provider/PKCE-verifier it was issued for. Consumed exactly once by
/// `take_by_state`, which deletes the row so replay is impossible.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OAuthState {
    pub id: Uuid,
    pub state: String,
    pub client_id: Uuid,
    pub user_id: Uuid,
    pub provider: Provider,
    pub pkce_verifier: String,
    pub redirect_uri: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

impl OAuthState {
    pub async fn create(
        pool: &PgPool,
        state: &str,
        client_id: Uuid,
        user_id: Uuid,
        provider: Provider,
        pkce_verifier: &str,
        redirect_uri: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<OAuthState, sqlx::Error> {
        sqlx::query_as::<_, OAuthState>(
            r#"insert into oauth_states (state, client_id, user_id, provider, pkce_verifier, redirect_uri, expires_at)
               values ($1, $2, $3, $4, $5, $6, $7)
               returning id, state, client_id, user_id, provider, pkce_verifier, redirect_uri, expires_at, created_at"#,
        )
        .bind(state)
        .bind(client_id)
        .bind(user_id)
        .bind(provider)
        .bind(pkce_verifier)
        .bind(redirect_uri)
        .bind(expires_at)
        .fetch_one(pool)
        .await
    }

    /// Atomically deletes and returns the matching, non-expired state row.
    pub async fn take_by_state(
        pool: &PgPool,
        state: &str,
    ) -> Result<Option<OAuthState>, sqlx::Error> {
        sqlx::query_as::<_, OAuthState>(
            r#"delete from oauth_states where state = $1 and expires_at > now()
               returning id, state, client_id, user_id, provider, pkce_verifier, redirect_uri, expires_at, created_at"#,
        )
        .bind(state)
        .fetch_optional(pool)
        .await
    }

    pub async fn delete_expired(pool: &PgPool) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("delete from oauth_states where expires_at <= now()")
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }
}
