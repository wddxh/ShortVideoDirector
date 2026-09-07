#!/usr/bin/env bash
# Usage: bash scripts/parse-new-assets.sh SCRIPT [new|existing|all]
# Default output: newline-delimited new asset paths. Exit 1 on invalid input.

set -e
exec node "$(dirname -- "${BASH_SOURCE[0]}")/episode-assets.mjs" "$@"
