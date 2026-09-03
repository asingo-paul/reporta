#[derive(thiserror::Error, Debug)]
pub enum ReportError {
    #[error("report not found")]
    NotFound,
    #[error("client has no connected data sources")]
    NoConnections,
    #[error(transparent)]
    Db(#[from] sqlx::Error),
    #[error(transparent)]
    Integration(#[from] reporta_integrations::IntegrationError),
    #[error(transparent)]
    Insights(#[from] reporta_insights::InsightsError),
    #[error(transparent)]
    Pdf(#[from] reporta_pdf::PdfError),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}
