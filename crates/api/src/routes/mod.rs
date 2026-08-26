pub mod auth;
pub mod billing;
pub mod clients;
pub mod integrations;
pub mod reports;
pub mod template;
pub mod uploads;

use axum::routing::{delete, get, patch, post};
use axum::Router;
use reporta_common::AppError;
use regex::Regex;
use std::sync::OnceLock;

use crate::state::AppState;

fn hex_color_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^#[0-9A-Fa-f]{6}$").unwrap())
}

pub fn validate_hex_color(value: &str) -> Result<(), AppError> {
    if hex_color_re().is_match(value) {
        Ok(())
    } else {
        Err(AppError::Validation(format!("'{value}' is not a valid hex color (expected #RRGGBB)")))
    }
}

pub fn build_router(state: AppState) -> Router {
    let auth_routes = Router::new()
        .route("/signup", post(auth::signup))
        .route("/login", post(auth::login))
        .route("/refresh", post(auth::refresh))
        .route("/logout", post(auth::logout))
        .route("/me", get(auth::me));

    let client_routes = Router::new()
        .route("/", get(clients::list_clients).post(clients::create_client))
        .route(
            "/{client_id}",
            get(clients::get_client).put(clients::update_client).delete(clients::delete_client),
        )
        .route("/{client_id}/connections", get(clients::list_connections))
        .route("/{client_id}/connections/{connection_id}", delete(clients::revoke_connection))
        .route("/{client_id}/reports", get(reports::list_reports).post(reports::generate_report));

    let template_routes = Router::new()
        .route("/", get(template::get_template).put(template::update_template))
        .route("/logo", post(template::upload_logo));

    let integration_routes = Router::new()
        .route("/{provider}/authorize", get(integrations::authorize))
        .route("/{provider}/callback", get(integrations::callback));

    let report_routes = Router::new()
        .route("/{report_id}", get(reports::get_report))
        .route("/{report_id}/events", get(reports::report_events))
        .route("/{report_id}", patch(reports::update_summary))
        .route("/{report_id}/pdf", get(reports::download_pdf))
        .route("/{report_id}/send", post(reports::send_report));

    let billing_routes = Router::new()
        .route("/checkout-session", post(billing::create_checkout_session))
        .route("/portal", post(billing::create_portal_session))
        .route("/subscription", get(billing::get_subscription))
        .route("/webhook", post(billing::webhook));

    let upload_routes =
        Router::new().route("/{filename}", get(uploads::serve_upload));

    let api_router = Router::new()
        .route("/health", get(|| async { "OK" }))
        .nest("/auth", auth_routes)
        .nest("/clients", client_routes)
        .nest("/template", template_routes)
        .nest("/integrations", integration_routes)
        .nest("/reports", report_routes)
        .nest("/billing", billing_routes)
        .nest("/uploads", upload_routes);

    Router::new()
        .nest("/api/v1", api_router)
        .with_state(state)
}
