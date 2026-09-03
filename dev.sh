#!/usr/bin/env bash
# Convenience shim so `./dev.sh` works from the repo root.
# See scripts/dev.sh for what this starts (api + worker by default).
exec "$(dirname "$0")/scripts/dev.sh" "$@"
