use axum::extract::{Path, State};
use axum::Json;
use reporta_common::{AppError, AppResult};
use reporta_db::models::Client;
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::audit;
use crate::extractors::{AuthUser, ClientIp};
use crate::state::AppState;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateClientRequest {
    #[validate(length(min = 1, max = 200))]
    name: String,
}

pub async fn list_clients(State(state): State<AppState>, AuthUser(user_id): AuthUser) -> AppResult<Json<Vec<Client>>> {
    Ok(Json(Client::list_for_user(&state.pool, user_id).await?))
}

pub async fn create_client(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
    Json(req): Json<CreateClientRequest>,
) -> AppResult<Json<Client>> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let client = Client::create(&state.pool, user_id, &req.name).await?;

    audit::record(
        &state.pool,
        Some(user_id),
        "client.created",
        Some("client"),
        Some(client.id),
        serde_json::json!({ "name": client.name }),
        ip.as_deref(),
    );
    Ok(Json(client))
}

pub async fn get_client(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(client_id): Path<Uuid>,
) -> AppResult<Json<Client>> {
    let client = Client::find_for_user(&state.pool, client_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(client))
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateClientRequest {
    #[validate(length(min = 1, max = 200))]
    name: String,
    brand_primary_color: String,
    brand_secondary_color: String,
    intro_blurb: Option<String>,
}

pub async fn update_client(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
    Path(client_id): Path<Uuid>,
    Json(req): Json<UpdateClientRequest>,
) -> AppResult<Json<Client>> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    crate::routes::validate_hex_color(&req.brand_primary_color)?;
    crate::routes::validate_hex_color(&req.brand_secondary_color)?;
    let client = Client::update(
        &state.pool,
        client_id,
        user_id,
        &req.name,
        None,
        &req.brand_primary_color,
        &req.brand_secondary_color,
        req.intro_blurb.as_deref(),
    )
    .await?
    .ok_or(AppError::NotFound)?;

    audit::record(
        &state.pool,
        Some(user_id),
        "client.updated",
        Some("client"),
        Some(client.id),
        serde_json::json!({ "name": client.name }),
        ip.as_deref(),
    );
    Ok(Json(client))
}

pub async fn delete_client(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
    Path(client_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    // Fetch first so the log can name what was destroyed — after the delete
    // the row (and its name) is gone, and `on delete cascade` also takes all
    // of the client's reports and connections with it.
    let client = Client::find_for_user(&state.pool, client_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let deleted = Client::delete(&state.pool, client_id, user_id).await?;
    if !deleted {
        return Err(AppError::NotFound);
    }

    audit::record(
        &state.pool,
        Some(user_id),
        "client.deleted",
        Some("client"),
        Some(client_id),
        serde_json::json!({ "name": client.name }),
        ip.as_deref(),
    );
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_connections(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(client_id): Path<Uuid>,
) -> AppResult<Json<Vec<serde_json::Value>>> {
    Client::find_for_user(&state.pool, client_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    let connections = reporta_db::models::Connection::list_for_client(&state.pool, client_id).await?;
    let public: Vec<serde_json::Value> = connections
        .into_iter()
        .map(|c| {
            serde_json::json!({
                "id": c.id,
                "provider": c.provider,
                "external_account_id": c.external_account_id,
                "external_account_name": c.external_account_name,
                "status": c.status,
                "expires_at": c.expires_at,
                "last_synced_at": c.last_synced_at,
            })
        })
        .collect();
    Ok(Json(public))
}

pub async fn revoke_connection(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    ClientIp(ip): ClientIp,
    Path((client_id, connection_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    Client::find_for_user(&state.pool, client_id, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Capture the provider before the row is deleted so the log records
    // *which* integration was disconnected.
    let provider = reporta_db::models::Connection::list_for_client(&state.pool, client_id)
        .await?
        .into_iter()
        .find(|c| c.id == connection_id)
        .map(|c| c.provider);

    let revoked = reporta_db::models::Connection::revoke(&state.pool, connection_id, client_id).await?;
    if !revoked {
        return Err(AppError::NotFound);
    }

    audit::record(
        &state.pool,
        Some(user_id),
        "connection.revoked",
        Some("connection"),
        Some(connection_id),
        serde_json::json!({ "client_id": client_id, "provider": provider }),
        ip.as_deref(),
    );
    Ok(Json(serde_json::json!({ "ok": true })))
}
