use axum::extract::{FromRequestParts, State};
use axum::http::request::Parts;
use reporta_common::AppError;
use uuid::Uuid;

use crate::state::AppState;

/// The authenticated user's id, extracted from a `Bearer` access token in
/// the `Authorization` header. Deliberately header-based rather than a
/// cookie: the access token never rides in a cookie, so authenticated
/// requests carry no ambient credential a cross-site request could replay —
/// there is nothing here for CSRF to exploit. Only the long-lived refresh
/// token is a cookie (httpOnly, scoped to the refresh endpoint, SameSite
/// Strict), used exclusively by the explicit `/auth/refresh` call.
pub struct AuthUser(pub Uuid);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let State(state) = State::<AppState>::from_request_parts(parts, state)
            .await
            .map_err(|_| AppError::Unauthorized)?;

        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = header.strip_prefix("Bearer ").ok_or(AppError::Unauthorized)?;
        let claims = state.jwt.verify_access_token(token).map_err(|_| AppError::Unauthorized)?;
        Ok(AuthUser(claims.sub))
    }
}
