-- Reporta initial schema.
-- Forward-only migrations (sqlx convention): never edit an applied file, add a new one.

create extension if not exists pgcrypto;

create type provider as enum ('meta', 'ga4', 'google_ads');
create type report_status as enum ('pending', 'pulling_data', 'analyzing', 'rendering', 'completed', 'failed');
create type job_status as enum ('queued', 'running', 'succeeded', 'failed');

create table users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    password_hash text not null,
    name text not null,
    role text not null default 'owner',
    stripe_customer_id text unique,
    email_verified_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Refresh tokens are stored as a SHA-256 hash, never the raw token, and are
-- rotated on every use (replaced_by links the chain for reuse detection).
create table refresh_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token_hash text not null unique,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    replaced_by uuid references refresh_tokens(id),
    created_at timestamptz not null default now()
);
create index idx_refresh_tokens_user_id on refresh_tokens(user_id);

create table subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references users(id) on delete cascade,
    stripe_subscription_id text unique,
    stripe_price_id text,
    status text not null default 'incomplete',
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table clients (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    name text not null,
    logo_url text,
    brand_primary_color text not null default '#4F46E5',
    brand_secondary_color text not null default '#111827',
    intro_blurb text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index idx_clients_user_id on clients(user_id);

-- OAuth access/refresh tokens are stored AES-256-GCM encrypted at rest
-- (ciphertext + nonce columns); the key never touches the database.
create table connections (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references clients(id) on delete cascade,
    provider provider not null,
    external_account_id text,
    external_account_name text,
    access_token_encrypted bytea not null,
    access_token_nonce bytea not null,
    refresh_token_encrypted bytea,
    refresh_token_nonce bytea,
    scopes text[] not null default '{}',
    expires_at timestamptz,
    status text not null default 'active',
    last_synced_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (client_id, provider)
);

-- Short-lived, single-use OAuth CSRF-state + PKCE-verifier records.
create table oauth_states (
    id uuid primary key default gen_random_uuid(),
    state text not null unique,
    client_id uuid not null references clients(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    provider provider not null,
    pkce_verifier text not null,
    redirect_uri text not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);
create index idx_oauth_states_expires_at on oauth_states(expires_at);

-- One template per agency account ("Configure the Template, done once").
create table report_templates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references users(id) on delete cascade,
    logo_url text,
    brand_primary_color text not null default '#4F46E5',
    brand_secondary_color text not null default '#111827',
    enabled_metrics text[] not null default '{}',
    intro_blurb text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table reports (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references clients(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    period_start date not null,
    period_end date not null,
    status report_status not null default 'pending',
    progress_message text,
    raw_metrics jsonb,
    previous_raw_metrics jsonb,
    ai_summary text,
    ai_summary_edited boolean not null default false,
    pdf_path text,
    error text,
    sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index idx_reports_client_id on reports(client_id);
create index idx_reports_user_id on reports(user_id);

-- Postgres-backed job queue for report generation, consumed with
-- `FOR UPDATE SKIP LOCKED` by the worker binary.
create table report_jobs (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null unique references reports(id) on delete cascade,
    status job_status not null default 'queued',
    attempts int not null default 0,
    max_attempts int not null default 3,
    run_after timestamptz not null default now(),
    locked_at timestamptz,
    locked_by text,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index idx_report_jobs_pending on report_jobs(run_after) where status = 'queued';

create table audit_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete set null,
    action text not null,
    target_type text,
    target_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    ip_address text,
    created_at timestamptz not null default now()
);
create index idx_audit_logs_user_id on audit_logs(user_id);
