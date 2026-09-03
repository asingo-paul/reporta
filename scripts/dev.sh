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
# Writable host dir instead of the container-only /data/uploads. Forced (not
# defaulted): .env carries UPLOAD_DIR=/data/uploads for the Docker deployment,
# and if that ever leaks into this shell's environment the worker would try to
# write PDFs to a non-existent root-owned path and every report would fail
# with "Permission denied (os error 13)".
export UPLOAD_DIR="$ROOT/.dev-uploads"

mkdir -p "$UPLOAD_DIR"

# The cargo workspace lives under crates/.
cd "$ROOT/crates"

TARGET="${1:-all}"
shift 2>/dev/null || true

build_flags=()
if [ "${RELEASE:-1}" = "1" ]; then
    build_flags+=(--release)
fi

# `all` just runs the API: it already spawns the report worker in-process
# (see crates/api/src/main.rs), so a separate `reporta-worker` here would only
# double up on the job queue. The standalone `worker` target still exists for
# production, where API and worker run as separate containers.
if [ "$TARGET" = "all" ]; then
    trap 'kill 0' EXIT INT TERM
    echo "[dev] starting reporta-api (report worker runs in-process; Ctrl-C to stop)"
    exec cargo run "${build_flags[@]}" --bin reporta-api -- "$@"
fi

BIN="reporta-$TARGET"
if [ "${RELEASE:-1}" = "1" ]; then
    exec cargo run --release --bin "$BIN" -- "$@"
else
    exec cargo run --bin "$BIN" -- "$@"
fi
