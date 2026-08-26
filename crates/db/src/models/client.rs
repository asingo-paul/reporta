use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct Client {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub logo_url: Option<String>,
    pub brand_primary_color: String,
    pub brand_secondary_color: String,
    pub intro_blurb: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Client {
    pub async fn create(pool: &PgPool, user_id: Uuid, name: &str) -> Result<Client, sqlx::Error> {
        sqlx::query_as::<_, Client>(
            r#"insert into clients (user_id, name) values ($1, $2)
               returning id, user_id, name, logo_url, brand_primary_color,
                         brand_secondary_color, intro_blurb, created_at, updated_at"#,
        )
        .bind(user_id)
        .bind(name)
        .fetch_one(pool)
        .await
    }

    pub async fn list_for_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<Client>, sqlx::Error> {
        sqlx::query_as::<_, Client>(
            r#"select id, user_id, name, logo_url, brand_primary_color,
                      brand_secondary_color, intro_blurb, created_at, updated_at
               from clients where user_id = $1 order by created_at desc"#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
    }

    /// Unscoped lookup for internal (worker/job) use where there is no
    /// authenticated request context to scope by. Never expose this to an
    /// API handler that takes a client id from user input — use
    /// `find_for_user` there instead.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Client>, sqlx::Error> {
        sqlx::query_as::<_, Client>(
            r#"select id, user_id, name, logo_url, brand_primary_color,
                      brand_secondary_color, intro_blurb, created_at, updated_at
               from clients where id = $1"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    /// Scoped by `user_id` on every lookup so one agency account can never
    /// read or mutate another agency's client records.
    pub async fn find_for_user(
        pool: &PgPool,
        id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<Client>, sqlx::Error> {
        sqlx::query_as::<_, Client>(
            r#"select id, user_id, name, logo_url, brand_primary_color,
                      brand_secondary_color, intro_blurb, created_at, updated_at
               from clients where id = $1 and user_id = $2"#,
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn update(
        pool: &PgPool,
        id: Uuid,
        user_id: Uuid,
        name: &str,
        logo_url: Option<&str>,
        brand_primary_color: &str,
        brand_secondary_color: &str,
        intro_blurb: Option<&str>,
    ) -> Result<Option<Client>, sqlx::Error> {
        sqlx::query_as::<_, Client>(
            r#"update clients set
                 name = $3, logo_url = coalesce($4, logo_url),
                 brand_primary_color = $5, brand_secondary_color = $6,
                 intro_blurb = $7, updated_at = now()
               where id = $1 and user_id = $2
               returning id, user_id, name, logo_url, brand_primary_color,
                         brand_secondary_color, intro_blurb, created_at, updated_at"#,
        )
        .bind(id)
        .bind(user_id)
        .bind(name)
        .bind(logo_url)
        .bind(brand_primary_color)
        .bind(brand_secondary_color)
        .bind(intro_blurb)
        .fetch_optional(pool)
        .await
    }

    pub async fn delete(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("delete from clients where id = $1 and user_id = $2")
            .bind(id)
            .bind(user_id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}
