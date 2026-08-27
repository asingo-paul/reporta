# Reporta — Environment Keys & Where to Get Them

This file tells you **every key/credential** Reporta reads from its `.env` files, what it's for, and the exact place to obtain each one.

There are **two** `.env` files to fill in:

| File | Purpose |
|------|---------|
| `/home/paul/reporta/.env` | Backend: API + worker (copy from `.env.example`) |
| `/home/paul/reporta/reporta-frontend/.env` | Frontend: the API base URL the browser talks to |

> **Never commit real secrets.** A template exists at `.env.example`. Copy it, fill in values, and keep `.env` out of version control.
>
> **Generate random secrets locally** (don't copy examples): `openssl rand -base64 48`.

---

## 1. Core — every environment

| Key | Applies to | Generate / get from |
|-----|-----------|---------------------|
| `APP_ENV` | Backend `.env` | `development`, `staging`, or `production` |
| `PORT` | Backend `.env` | `8080` (default) |
| `APP_BASE_URL` | Backend `.env` | Your own value — the **public URL of the API**. Used to build OAuth redirect URIs. Dev: `http://localhost:8080` |
| `FRONTEND_BASE_URL` | Backend `.env` | Your own value — the **public URL of the frontend**. Used for CORS and after-OAuth/Stripe redirects. Dev: `http://localhost:5173` |

---

## 2. Database & cache

| Key | Applies to | Get from |
|-----|-----------|----------|
| `DATABASE_URL` | Backend `.env` | Your own Postgres. Dev default matches `docker-compose.yml`: `postgres://reporta:reporta@localhost:5432/reporta` |
| `REDIS_URL` | Backend `.env` | Your own Redis. Dev (from docker-compose): `redis://localhost:6379` |

> Both Postgres and Redis are in `docker-compose.yml` — `docker compose up postgres redis` gives you working databases locally.

---

## 3. Auth — generate these yourself

| Key | Applies to | How to generate |
|-----|-----------|-----------------|
| `JWT_SECRET` | Backend `.env` | `openssl rand -base64 48` (any long random string — signs JWT access tokens) |
| `TOKEN_ENCRYPTION_KEY` | Backend `.env` | `openssl rand -base64 32` — must decode to **exactly 32 bytes** (AES-256-GCM encryption of OAuth tokens at rest). Make a fresh one per environment; never reuse across dev/staging/prod. |
| `ACCESS_TOKEN_TTL_SECS` | Backend `.env` | `900` (15 min, default) |
| `REFRESH_TOKEN_TTL_SECS` | Backend `.env` | `1209600` (14 days, default) |
---

## 4. AI summaries — any OpenAI-compatible provider

The backend speaks the OpenAI Chat Completions protocol with a **configurable endpoint**, so it works with OpenAI itself or any compatible provider:

| Key | Applies to | Get from |
|-----|-----------|----------|
| `OPENAI_API_KEY` | Backend `.env` | Provider API key. Needed for AI executive summaries. (Optional — reports fall back to a deterministic template without it.) |
| `OPENAI_BASE_URL` | Backend `.env` | Full chat-completions URL of your chosen provider. Leave empty for OpenAI itself (`https://api.openai.com/v1/chat/completions`). |
| `OPENAI_MODEL` | Backend `.env` | Model ID for that provider. |

**Free options (no money needed):**

| Provider | `OPENAI_BASE_URL` | Example `OPENAI_MODEL` | Get key from |
|----------|-------------------|------------------------|--------------|
| **Google Gemini** (recommended) | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | `gemini-3.7-flash` | **https://aistudio.google.com/apikey** |
| Groq | `https://api.groq.com/openai/v1/chat/completions` | `llama-3.3-70b-versatile` | https://console.groq.com/keys |
| OpenAI (paid only) | `https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` | https://platform.openai.com/api-keys |

---

## 5. Billing — Stripe (use **sandbox / test mode** while developing)

| Key | Applies to | Get from |
|-----|-----------|----------|
| `STRIPE_SECRET_KEY` | Backend `.env` | **https://dashboard.stripe.com/apikeys** — make sure the dashboard toggle is on **Test mode**. Use the `sk_test_...` key. |
| `STRIPE_PRICE_ID` | Backend `.env` | **https://dashboard.stripe.com/products** → create a recurring (subscription) price for the $29/mo plan → copy the `price_...` ID. |
| `STRIPE_WEBHOOK_SECRET` | Backend `.env` | **https://dashboard.stripe.com/webhooks** → add an endpoint `POST {APP_BASE_URL}/api/v1/billing/webhook` → copy the `whsec_...` signing secret. |

**Local webhook testing:** run Stripe CLI to forward events to your local API:

```bash
stripe login
stripe listen --forward-to localhost:8080/api/v1/billing/webhook
# -> it prints a whsec_... secret; put it in STRIPE_WEBHOOK_SECRET
```

