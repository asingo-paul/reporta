use chrono::{Duration, Utc};
use rand::TryRng;
use reporta_db::models::RefreshToken;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(thiserror::Error, Debug)]
pub enum RefreshError {
    #[error("invalid refresh token")]
    Invalid,
    #[error("refresh token expired")]
    Expired,
    /// A rotated-out (already-used) refresh token was presented again — the
    /// full token chain for this user has been revoked as a precaution and
    /// the client must re-authenticate.
    #[error("refresh token reuse detected; all sessions revoked")]
    ReuseDetected,
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

fn generate_opaque_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::SysRng
        .try_fill_bytes(&mut bytes)
        .expect("OS RNG failure");
    base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, bytes)
}

fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

pub struct RefreshTokenService {
    ttl_secs: i64,
}

impl RefreshTokenService {
    pub fn new(ttl_secs: i64) -> Self {
        Self { ttl_secs }
    }

    /// Issues a brand-new refresh token for a fresh login (not a rotation).
    pub async fn issue(&self, pool: &PgPool, user_id: Uuid) -> Result<String, RefreshError> {
        let raw = generate_opaque_token();
        let expires_at = Utc::now() + Duration::seconds(self.ttl_secs);
        RefreshToken::create(pool, user_id, &hash_token(&raw), expires_at).await?;
        Ok(raw)
    }

    /// Validates a presented refresh token and rotates it: the old token is
    /// revoked and a new one issued in the same breath, so a stolen-and-used
    /// token can never be replayed.
    pub async fn rotate(
        &self,
        pool: &PgPool,
        presented_raw_token: &str,
    ) -> Result<(Uuid, String), RefreshError> {
        let hash = hash_token(presented_raw_token);
        let existing = RefreshToken::find_by_hash_any(pool, &hash)
            .await?
            .ok_or(RefreshError::Invalid)?;

        if existing.revoked_at.is_some() {
            RefreshToken::revoke_all_for_user(pool, existing.user_id).await?;
            return Err(RefreshError::ReuseDetected);
        }
        if existing.expires_at <= Utc::now() {
            return Err(RefreshError::Expired);
        }

        let new_raw = generate_opaque_token();
        let expires_at = Utc::now() + Duration::seconds(self.ttl_secs);
        let new_token = RefreshToken::create(pool, existing.user_id, &hash_token(&new_raw), expires_at).await?;
        RefreshToken::revoke(pool, existing.id, Some(new_token.id)).await?;

        Ok((existing.user_id, new_raw))
    }

    pub async fn revoke(&self, pool: &PgPool, raw_token: &str) -> Result<(), RefreshError> {
        let hash = hash_token(raw_token);
        if let Some(existing) = RefreshToken::find_by_hash_any(pool, &hash).await? {
            RefreshToken::revoke(pool, existing.id, None).await?;
        }
        Ok(())
    }
}
