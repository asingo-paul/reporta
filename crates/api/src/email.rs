use lettre::message::header::ContentType;
use lettre::message::{Attachment, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use reporta_common::Config;

#[derive(thiserror::Error, Debug)]
pub enum MailError {
    #[error("email is not configured on this server (missing SMTP settings)")]
    NotConfigured,
    #[error("failed to build email: {0}")]
    Build(String),
    #[error("failed to send email: {0}")]
    Send(String),
}

pub struct Mailer {
    transport: Option<AsyncSmtpTransport<Tokio1Executor>>,
    from: String,
}

impl Mailer {
    pub fn new(config: &Config) -> Self {
        let transport = config.smtp_host.as_ref().map(|host| {
            let mut builder = AsyncSmtpTransport::<Tokio1Executor>::relay(host)
                .expect("SMTP_HOST must be a valid hostname")
                .port(config.smtp_port);
            if let (Some(user), Some(pass)) = (&config.smtp_username, &config.smtp_password) {
                builder = builder.credentials(Credentials::new(user.clone(), pass.clone()));
            }
            builder.build()
        });

        Self {
            transport,
            from: config.smtp_from.clone(),
        }
    }

    /// Emails the finished PDF report directly to the client, per the
    /// spec's "Send to Client" action.
    pub async fn send_report(
        &self,
        to_email: &str,
        to_name: &str,
        agency_name: &str,
        client_name: &str,
        pdf_bytes: Vec<u8>,
        pdf_filename: &str,
    ) -> Result<(), MailError> {
        let transport = self.transport.as_ref().ok_or(MailError::NotConfigured)?;

        let body_text = format!(
            "Hi {to_name},\n\nPlease find attached your latest performance report from {agency_name}.\n\nBest,\n{agency_name}"
        );

        let attachment = Attachment::new(pdf_filename.to_string())
            .body(pdf_bytes, ContentType::parse("application/pdf").map_err(|e| MailError::Build(e.to_string()))?);

        let email = Message::builder()
            .from(self.from.parse().map_err(|e: lettre::address::AddressError| MailError::Build(e.to_string()))?)
            .to(to_email.parse().map_err(|e: lettre::address::AddressError| MailError::Build(e.to_string()))?)
            .subject(format!("{client_name}'s Performance Report from {agency_name}"))
            .multipart(
                MultiPart::mixed()
                    .singlepart(SinglePart::plain(body_text))
                    .singlepart(attachment),
            )
            .map_err(|e| MailError::Build(e.to_string()))?;

        transport
            .send(email)
            .await
            .map(|_| ())
            .map_err(|e| MailError::Send(e.to_string()))
    }
}
