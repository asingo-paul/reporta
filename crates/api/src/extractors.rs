use axum::extract::{FromRequestParts, State};
use axum::http::request::Parts;
use reporta_common::AppError;
use std::convert::Infallible;
use std::net::SocketAddr;
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

/// Best-effort client IP for audit records. Deployment sits behind a reverse
/// proxy (Caddy/nginx), which sets `X-Forwarded-For`/`X-Real-IP`; when those
/// are absent (direct access, dev) we fall back to the direct socket address.
/// Never rejects: a missing IP must not fail a request that only wants to log
/// one, so audit rows may simply carry a null `ip_address`.
pub struct ClientIp(pub Option<String>);

impl<S> FromRequestParts<S> for ClientIp
where
    S: Send + Sync,
{
    type Rejection = Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let header_str =
            |name: &str| parts.headers.get(name).and_then(|v| v.to_str().ok()).map(str::trim);

        // `X-Forwarded-For` is a comma-separated chain (client, proxy1, ...);
        // our own proxy appends the socket peer, so the first entry is the
        // originating client as seen by the trusted proxy.
        let forwarded_for = header_str("x-forwarded-for")
            .and_then(|v| v.split(',').next())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);

        let real_ip = header_str("x-real-ip").filter(|s| !s.is_empty()).map(str::to_string);

        let socket_ip = parts
            .extensions
            .get::<axum::extract::ConnectInfo<SocketAddr>>()
            .map(|info| info.0.ip().to_string());

        Ok(ClientIp(forwarded_for.or(real_ip).or(socket_ip)))
    }
}
