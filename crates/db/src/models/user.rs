use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub name: String,
    pub role: String,
    pub stripe_customer_id: Option<String>,
    pub email_verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    pub async fn create(
        pool: &PgPool,
        email: &str,
        password_hash: &str,
        name: &str,
    ) -> Result<User, sqlx::Error> {
        sqlx::query_as::<_, User>(
            r#"
            insert into users (email, password_hash, name)
            values ($1, $2, $3)
            returning id, email, password_hash, name, role, stripe_customer_id,
                      email_verified_at, created_at, updated_at
            "#,
        )
        .bind(email.to_lowercase())
        .bind(password_hash)
        .bind(name)
        .fetch_one(pool)
        .await
    }

    pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, sqlx::Error> {
        sqlx::query_as::<_, User>(
            r#"select id, email, password_hash, name, role, stripe_customer_id,
                      email_verified_at, created_at, updated_at
               from users where email = $1"#,
        )
        .bind(email.to_lowercase())
        .fetch_optional(pool)
        .await
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>, sqlx::Error> {
        sqlx::query_as::<_, User>(
            r#"select id, email, password_hash, name, role, stripe_customer_id,
                      email_verified_at, created_at, updated_at
               from users where id = $1"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    pub async fn find_by_stripe_customer_id(
        pool: &PgPool,
        stripe_customer_id: &str,
    ) -> Result<Option<User>, sqlx::Error> {
        sqlx::query_as::<_, User>(
            r#"select id, email, password_hash, name, role, stripe_customer_id,
                      email_verified_at, created_at, updated_at
               from users where stripe_customer_id = $1"#,
        )
        .bind(stripe_customer_id)
        .fetch_optional(pool)
        .await
    }

    pub async fn set_stripe_customer_id(
        pool: &PgPool,
        id: Uuid,
        stripe_customer_id: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("update users set stripe_customer_id = $1, updated_at = now() where id = $2")
            .bind(stripe_customer_id)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
