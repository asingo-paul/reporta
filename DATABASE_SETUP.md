# Database Setup & Migrations Guide

## Overview

Reporta uses PostgreSQL with SQLx for database migrations. The migrations are located in `/home/paul/reporta/migrations/`.

## Prerequisites

1. **PostgreSQL** installed and running
2. **Rust & Cargo** installed
3. **sqlx-cli** (will be installed automatically if needed)

## Quick Setup

### 1. Start PostgreSQL

If using Docker:
```bash
docker-compose up -d postgres
```

Or start your local PostgreSQL service:
```bash
sudo systemctl start postgresql
# or
brew services start postgresql
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE reporta;
CREATE USER reporta WITH PASSWORD 'reporta';
GRANT ALL PRIVILEGES ON DATABASE reporta TO reporta;
\q
```

### 3. Configure Environment

Create `.env` file from the example:
```bash
cp .env.example .env
```

Update `DATABASE_URL` in `.env`:
```env
DATABASE_URL=postgres://reporta:reporta@localhost:5432/reporta
```

## Running Migrations

### Method 1: Automatic (Recommended)

Migrations run automatically when you start the API:

```bash
cd crates/api
cargo run
```

The API will:
1. Connect to the database
2. Run any pending migrations
3. Start the server

### Method 2: Manual Script

Use the provided script:

```bash
./run-migrations.sh
```

This will:
- Check for `.env` file
- Install `sqlx-cli` if needed
- Run all pending migrations

### Method 3: Using sqlx-cli Directly

Install sqlx-cli:
```bash
cargo install sqlx-cli --no-default-features --features postgres
```

Run migrations:
```bash
sqlx migrate run --database-url "postgres://reporta:reporta@localhost:5432/reporta"
```

## Migration Commands

### Check Migration Status
```bash
sqlx migrate info --database-url "$DATABASE_URL"
```

### Run Pending Migrations
```bash
sqlx migrate run --database-url "$DATABASE_URL"
```

### Revert Last Migration
```bash
sqlx migrate revert --database-url "$DATABASE_URL"
```

### Create New Migration
```bash
sqlx migrate add <migration_name>
```

## Database Schema

The initial migration (`0001_init.sql`) creates:

### Tables
- **users** - User accounts with authentication
- **refresh_tokens** - JWT refresh token management
- **subscriptions** - Stripe subscription data
- **clients** - Client profiles for reports
- **connections** - OAuth connections (GA4, Google Ads, Meta)
- **oauth_states** - Temporary OAuth state for CSRF protection
- **report_templates** - Customizable report templates
- **reports** - Generated reports with metrics and AI insights
- **report_jobs** - Background job queue for report generation
- **audit_logs** - Audit trail for user actions

### Types
- **provider** - Enum: 'meta', 'ga4', 'google_ads'
- **report_status** - Enum: 'pending', 'pulling_data', 'analyzing', 'rendering', 'completed', 'failed'
- **job_status** - Enum: 'queued', 'running', 'succeeded', 'failed'

## Docker Setup

If using Docker Compose:

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
sleep 3

# Run migrations (they'll run automatically when you start the API)
docker-compose up -d api
```

## Troubleshooting

### Connection Refused
```
Error: Connection refused (os error 111)
```

**Solution:** Make sure PostgreSQL is running:
```bash
sudo systemctl status postgresql
# or
docker-compose ps
```

### Authentication Failed
```
Error: password authentication failed for user "reporta"
```

**Solution:** Check your `DATABASE_URL` matches your PostgreSQL credentials.

### Database Does Not Exist
```
Error: database "reporta" does not exist
```

**Solution:** Create the database first:
```bash
psql -U postgres -c "CREATE DATABASE reporta;"
```

### Migration Already Applied
```
Error: Migration X has already been applied
```

**Solution:** This is normal. SQLx tracks applied migrations and skips them.

### Permission Denied
```
Error: permission denied to create extension "pgcrypto"
```

**Solution:** Grant superuser or extension creation rights:
```bash
psql -U postgres -d reporta -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

## Migration Best Practices

1. **Never edit applied migrations** - Create new ones instead
2. **Test locally first** - Run migrations on dev before production
3. **Backup before migrating** - Always backup production data
4. **Forward-only** - Reporta uses forward-only migrations
5. **Review SQL** - Check the migration file before applying

## Connection String Format

```
postgres://username:password@host:port/database
```

Examples:
- Local: `postgres://reporta:reporta@localhost:5432/reporta`
- Docker: `postgres://reporta:reporta@postgres:5432/reporta`
- Remote: `postgres://user:pass@db.example.com:5432/reporta`

## Verification

After running migrations, verify the schema:

```bash
psql -U reporta -d reporta

# List all tables
\dt

# Describe a table
\d users

# List custom types
\dT
```

Expected tables:
- audit_logs
- clients
- connections
- oauth_states
- refresh_tokens
- report_jobs
- report_templates
- reports
- subscriptions
- users

## Next Steps

After migrations are complete:

1. Start the API: `cd crates/api && cargo run`
2. Start the frontend: `cd reporta-frontend && npm run dev`
3. Create your first user via signup: http://localhost:5173/signup

## Support

If you encounter issues:
1. Check PostgreSQL logs
2. Verify `.env` configuration
3. Ensure PostgreSQL version is 12+
4. Check firewall/network settings

For more help, check the main README or Rust API logs.
