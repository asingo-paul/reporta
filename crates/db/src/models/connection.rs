use chrono::{DateTime, Utc};
use reporta_common::metrics::Provider;
use sqlx::PgPool;
use uuid::Uuid;

/// OAuth tokens are stored only in encrypted form (`*_encrypted` + `*_nonce`
/// columns, AES-256-GCM). This struct is deliberately not `Serialize` — it
/// must never be returned directly from an API handler; callers map it to a
/// public-safe DTO instead.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Connection {
    pub id: Uuid,
    pub client_id: Uuid,
    pub provider: Provider,
    pub external_account_id: Option<String>,
    pub external_account_name: Option<String>,
    pub access_token_encrypted: Vec<u8>,
    pub access_token_nonce: Vec<u8>,
    pub refresh_token_encrypted: Option<Vec<u8>>,
    pub refresh_token_nonce: Option<Vec<u8>>,
    pub scopes: Vec<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub status: String,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[allow(clippy::too_many_arguments)]
impl Connection {
    pub async fn upsert(
        pool: &PgPool,
        client_id: Uuid,
        provider: Provider,
        external_account_id: Option<&str>,
        external_account_name: Option<&str>,
        access_token_encrypted: &[u8],
        access_token_nonce: &[u8],
        refresh_token_encrypted: Option<&[u8]>,
        refresh_token_nonce: Option<&[u8]>,
        scopes: &[String],
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<Connection, sqlx::Error> {
        sqlx::query_as::<_, Connection>(
            r#"
            insert into connections
                (client_id, provider, external_account_id, external_account_name,
                 access_token_encrypted, access_token_nonce,
                 refresh_token_encrypted, refresh_token_nonce, scopes, expires_at, status)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
            on conflict (client_id, provider) do update set
                external_account_id = excluded.external_account_id,
                external_account_name = excluded.external_account_name,
                access_token_encrypted = excluded.access_token_encrypted,
                access_token_nonce = excluded.access_token_nonce,
                refresh_token_encrypted = coalesce(excluded.refresh_token_encrypted, connections.refresh_token_encrypted),
                refresh_token_nonce = coalesce(excluded.refresh_token_nonce, connections.refresh_token_nonce),
                scopes = excluded.scopes,
                expires_at = excluded.expires_at,
                status = 'active',
                updated_at = now()
            returning id, client_id, provider, external_account_id, external_account_name,
                      access_token_encrypted, access_token_nonce, refresh_token_encrypted,
                      refresh_token_nonce, scopes, expires_at, status, last_synced_at,
                      created_at, updated_at
            "#,
        )
        .bind(client_id)
        .bind(provider)
        .bind(external_account_id)
        .bind(external_account_name)
        .bind(access_token_encrypted)
        .bind(access_token_nonce)
        .bind(refresh_token_encrypted)
        .bind(refresh_token_nonce)
        .bind(scopes)
        .bind(expires_at)
        .fetch_one(pool)
        .await
    }

    pub async fn list_for_client(
        pool: &PgPool,
        client_id: Uuid,
    ) -> Result<Vec<Connection>, sqlx::Error> {
        sqlx::query_as::<_, Connection>(
            r#"select id, client_id, provider, external_account_id, external_account_name,
                      access_token_encrypted, access_token_nonce, refresh_token_encrypted,
                      refresh_token_nonce, scopes, expires_at, status, last_synced_at,
                      created_at, updated_at
               from connections where client_id = $1"#,
        )
        .bind(client_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_for_client(
        pool: &PgPool,
        client_id: Uuid,
        provider: Provider,
    ) -> Result<Option<Connection>, sqlx::Error> {
        sqlx::query_as::<_, Connection>(
            r#"select id, client_id, provider, external_account_id, external_account_name,
                      access_token_encrypted, access_token_nonce, refresh_token_encrypted,
                      refresh_token_nonce, scopes, expires_at, status, last_synced_at,
                      created_at, updated_at
               from connections where client_id = $1 and provider = $2"#,
        )
        .bind(client_id)
        .bind(provider)
        .fetch_optional(pool)
        .await
    }

    pub async fn mark_synced(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("update connections set last_synced_at = now() where id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Revoking deletes the row outright rather than soft-deleting: encrypted
    /// tokens for a disconnected account should not linger in the database.
    pub async fn revoke(
        pool: &PgPool,
        id: Uuid,
        client_id: Uuid,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("delete from connections where id = $1 and client_id = $2")
            .bind(id)
            .bind(client_id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}
