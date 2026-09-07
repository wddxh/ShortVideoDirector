#!/usr/bin/env bash
# Local concurrency defaults to five; use --concurrency 1 for serial execution.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
exec node "$SCRIPT_DIR/generate-storyboard-sheets-dreamina.mjs" "$@"
