use axum::extract::State;
use axum::Json;
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use reporta_auth::{hash_password, validate_strength, verify_password};
use reporta_common::{AppError, AppResult};
use reporta_db::models::User;
use serde::{Deserialize, Serialize};
use serde_json::json;
use validator::Validate;

use crate::extractors::AuthUser;
use crate::state::AppState;

const REFRESH_COOKIE: &str = "reporta_refresh";
const REFRESH_COOKIE_PATH: &str = "/api/v1/auth";

fn refresh_cookie<'a>(state: &AppState, value: String, max_age_secs: i64) -> Cookie<'a> {
    Cookie::build((REFRESH_COOKIE, value))
        .path(REFRESH_COOKIE_PATH)
        .http_only(true)
        .secure(state.config.is_production())
        .same_site(SameSite::Strict)
        .max_age(time::Duration::seconds(max_age_secs))
        .build()
}

#[derive(Debug, Deserialize, Validate)]
pub struct SignupRequest {
    #[validate(email)]
    email: String,
    password: String,
    #[validate(length(min = 1, max = 200))]
    name: String,
}

#[derive(Debug, Serialize)]
struct AuthResponse {
    access_token: String,
    user: PublicUser,
}

#[derive(Debug, Serialize)]
struct PublicUser {
    id: uuid::Uuid,
    email: String,
    name: String,
}

impl From<User> for PublicUser {
    fn from(u: User) -> Self {
        Self { id: u.id, email: u.email, name: u.name }
    }
}

pub async fn signup(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<SignupRequest>,
) -> AppResult<(CookieJar, Json<serde_json::Value>)> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    validate_strength(&req.password).map_err(|e| AppError::Validation(e.to_string()))?;

    if User::find_by_email(&state.pool, &req.email).await?.is_some() {
        return Err(AppError::Conflict("an account with this email already exists".to_string()));
    }

    let password_hash = hash_password(&req.password).map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
    let user = User::create(&state.pool, &req.email, &password_hash, &req.name).await?;

    let access_token = state
        .jwt
        .issue_access_token(user.id)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
    let refresh_token = state
        .refresh_tokens
        .issue(&state.pool, user.id)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let jar = jar.add(refresh_cookie(&state, refresh_token, state.config.refresh_token_ttl_secs));
    let body = json!(AuthResponse { access_token, user: user.into() });
    Ok((jar, Json(body)))
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    email: String,
    password: String,
}

pub async fn login(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<LoginRequest>,
) -> AppResult<(CookieJar, Json<serde_json::Value>)> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    let user = User::find_by_email(&state.pool, &req.email)
        .await?
        .ok_or(AppError::Unauthorized)?;
    if !verify_password(&req.password, &user.password_hash) {
        return Err(AppError::Unauthorized);
    }

    let access_token = state
        .jwt
        .issue_access_token(user.id)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
    let refresh_token = state
        .refresh_tokens
        .issue(&state.pool, user.id)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let jar = jar.add(refresh_cookie(&state, refresh_token, state.config.refresh_token_ttl_secs));
    let body = json!(AuthResponse { access_token, user: user.into() });
    Ok((jar, Json(body)))
}

pub async fn refresh(
    State(state): State<AppState>,
    jar: CookieJar,
) -> AppResult<(CookieJar, Json<serde_json::Value>)> {
    let raw = jar
        .get(REFRESH_COOKIE)
        .map(|c| c.value().to_string())
        .ok_or(AppError::Unauthorized)?;

    let (user_id, new_raw) = state.refresh_tokens.rotate(&state.pool, &raw).await.map_err(|e| {
        tracing::warn!(?e, "refresh token rotation failed");
        AppError::Unauthorized
    })?;

    let access_token = state
        .jwt
        .issue_access_token(user_id)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let jar = jar.add(refresh_cookie(&state, new_raw, state.config.refresh_token_ttl_secs));
    Ok((jar, Json(json!({ "access_token": access_token }))))
}

pub async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> AppResult<(CookieJar, Json<serde_json::Value>)> {
    if let Some(raw) = jar.get(REFRESH_COOKIE).map(|c| c.value().to_string()) {
        state.refresh_tokens.revoke(&state.pool, &raw).await.ok();
    }
    let jar = jar.remove(Cookie::from(REFRESH_COOKIE));
    Ok((jar, Json(json!({ "ok": true }))))
}

pub async fn me(State(state): State<AppState>, AuthUser(user_id): AuthUser) -> AppResult<Json<serde_json::Value>> {
    let user = User::find_by_id(&state.pool, user_id).await?.ok_or(AppError::Unauthorized)?;
    Ok(Json(json!(PublicUser::from(user))))
}
