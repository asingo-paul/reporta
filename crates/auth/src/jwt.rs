use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessClaims {
    /// Subject: the authenticated user's id.
    pub sub: Uuid,
    pub exp: i64,
    pub iat: i64,
}

#[derive(thiserror::Error, Debug)]
pub enum JwtError {
    #[error("invalid or expired token")]
    Invalid,
}

pub struct JwtIssuer {
    secret: String,
    access_ttl_secs: i64,
}

impl JwtIssuer {
    pub fn new(secret: String, access_ttl_secs: i64) -> Self {
        Self {
            secret,
            access_ttl_secs,
        }
    }

    pub fn issue_access_token(&self, user_id: Uuid) -> Result<String, JwtError> {
        let now = Utc::now();
        let claims = AccessClaims {
            sub: user_id,
            iat: now.timestamp(),
            exp: (now + Duration::seconds(self.access_ttl_secs)).timestamp(),
        };
        encode(
            &Header::new(Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(self.secret.as_bytes()),
        )
        .map_err(|_| JwtError::Invalid)
    }

    pub fn verify_access_token(&self, token: &str) -> Result<AccessClaims, JwtError> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.leeway = 5;
        decode::<AccessClaims>(
            token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &validation,
        )
        .map(|data| data.claims)
        .map_err(|_| JwtError::Invalid)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issues_and_verifies_token() {
        let issuer = JwtIssuer::new("test-secret-at-least-32-bytes-long".to_string(), 900);
        let user_id = Uuid::new_v4();
        let token = issuer.issue_access_token(user_id).unwrap();
        let claims = issuer.verify_access_token(&token).unwrap();
        assert_eq!(claims.sub, user_id);
    }

    #[test]
    fn rejects_tampered_token() {
        let issuer = JwtIssuer::new("test-secret-at-least-32-bytes-long".to_string(), 900);
        let token = issuer.issue_access_token(Uuid::new_v4()).unwrap();
        let mut tampered = token.clone();
        tampered.push('x');
        assert!(issuer.verify_access_token(&tampered).is_err());
    }

    #[test]
    fn rejects_token_signed_with_different_secret() {
        let issuer_a = JwtIssuer::new("secret-a-at-least-32-bytes-long!!".to_string(), 900);
        let issuer_b = JwtIssuer::new("secret-b-at-least-32-bytes-long!!".to_string(), 900);
        let token = issuer_a.issue_access_token(Uuid::new_v4()).unwrap();
        assert!(issuer_b.verify_access_token(&token).is_err());
    }
}
