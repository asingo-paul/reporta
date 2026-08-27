#!/usr/bin/env bash
# Run the Reporta backend natively (`cargo run`) so you get fast incremental
# Rust builds instead of rebuilding the whole Docker image on every change.
#
# Only Postgres / Redis / Mailhog stay in Docker (cached images, instant start,
# no build step):
#
#     docker compose up -d postgres redis          # infra
#     docker compose --profile dev up -d mailhog   # optional mail catcher
#
# Then:
#
#     ./scripts/dev.sh api      # HTTP API on :8080 (default)
#     ./scripts/dev.sh worker   # background report worker — REQUIRED or
#                               # generated reports stay stuck in "Pending"
#     ./scripts/dev.sh all      # both api + worker from one command
#
# The exported URLs override the docker-service hostnames in .env because
# dotenvy never replaces variables already set in the environment.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

export DATABASE_URL="${DATABASE_URL:-postgres://reporta:reporta@localhost:5432/reporta}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
# Writable host dir instead of the container-only /data/uploads.
export UPLOAD_DIR="${UPLOAD_DIR:-$ROOT/.dev-uploads}"

mkdir -p "$UPLOAD_DIR"

# The cargo workspace lives under crates/.
cd "$ROOT/crates"

TARGET="${1:-api}"
shift 2>/dev/null || true

build_flags=()
if [ "${RELEASE:-1}" = "1" ]; then
    build_flags+=(--release)
fi

# `all` runs the API and the report worker together (Ctrl-C stops both).
# The worker is what actually processes generated reports — without it they
# stay "Pending" forever.
if [ "$TARGET" = "all" ]; then
    trap 'kill 0' EXIT INT TERM
    echo "[dev] starting reporta-api + reporta-worker (Ctrl-C to stop both)"
    cargo run "${build_flags[@]}" --bin reporta-api -- "$@" &
    API_PID=$!
    cargo run "${build_flags[@]}" --bin reporta-worker -- "$@" &
    WORKER_PID=$!
    wait -n "$API_PID" "$WORKER_PID"
    exit $?
fi

BIN="reporta-$TARGET"
if [ "${RELEASE:-1}" = "1" ]; then
    exec cargo run --release --bin "$BIN" -- "$@"
else
    exec cargo run --bin "$BIN" -- "$@"
fi
