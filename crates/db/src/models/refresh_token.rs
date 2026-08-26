use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RefreshToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub replaced_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl RefreshToken {
    pub async fn create(
        pool: &PgPool,
        user_id: Uuid,
        token_hash: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<RefreshToken, sqlx::Error> {
        sqlx::query_as::<_, RefreshToken>(
            r#"insert into refresh_tokens (user_id, token_hash, expires_at)
               values ($1, $2, $3)
               returning id, user_id, token_hash, expires_at, revoked_at, replaced_by, created_at"#,
        )
        .bind(user_id)
        .bind(token_hash)
        .bind(expires_at)
        .fetch_one(pool)
        .await
    }

    /// Looks up a token row by hash regardless of revoked/expired state, so
    /// callers can distinguish "never existed" from "already used" (reuse of
    /// a rotated-out refresh token is a strong signal of theft).
    pub async fn find_by_hash_any(
        pool: &PgPool,
        token_hash: &str,
    ) -> Result<Option<RefreshToken>, sqlx::Error> {
        sqlx::query_as::<_, RefreshToken>(
            r#"select id, user_id, token_hash, expires_at, revoked_at, replaced_by, created_at
               from refresh_tokens where token_hash = $1"#,
        )
        .bind(token_hash)
        .fetch_optional(pool)
        .await
    }

    pub async fn find_valid_by_hash(
        pool: &PgPool,
        token_hash: &str,
    ) -> Result<Option<RefreshToken>, sqlx::Error> {
        sqlx::query_as::<_, RefreshToken>(
            r#"select id, user_id, token_hash, expires_at, revoked_at, replaced_by, created_at
               from refresh_tokens
               where token_hash = $1 and revoked_at is null and expires_at > now()"#,
        )
        .bind(token_hash)
        .fetch_optional(pool)
        .await
    }

    /// Rotates a refresh token: revokes the old one and links it to the new
    /// row. If a token is presented twice after rotation, that's evidence of
    /// theft/replay — callers should treat it as a signal to revoke the
    /// entire chain for the user.
    pub async fn revoke(pool: &PgPool, id: Uuid, replaced_by: Option<Uuid>) -> Result<(), sqlx::Error> {
        sqlx::query("update refresh_tokens set revoked_at = now(), replaced_by = $2 where id = $1")
            .bind(id)
            .bind(replaced_by)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn revoke_all_for_user(pool: &PgPool, user_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            "update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null",
        )
        .bind(user_id)
        .execute(pool)
        .await?;
        Ok(())
    }
}
