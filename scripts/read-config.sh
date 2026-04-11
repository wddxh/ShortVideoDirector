#!/usr/bin/env bash
# Extract a config value from config.md by key name.
# Usage: bash scripts/read-config.sh "键名" [config_path]
# Matches "- 键名: 值" lines, skips comment lines (starting with #).
# Strips inline comments (# ...) and leading/trailing whitespace from value.
# Exit codes: 0=found, 1=not found

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/read-config.sh \"键名\" [config_path]"
  exit 1
fi

KEY="$1"
CONFIG="${2:-config.md}"

if [ ! -f "$CONFIG" ]; then
  exit 1
fi

# Match "- KEY: VALUE" lines, skip lines starting with #
VALUE=$(grep -E "^- ${KEY}:" "$CONFIG" | head -1 | sed "s/^- ${KEY}:[[:space:]]*//" | sed 's/[[:space:]]*#.*$//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

if [ -z "$VALUE" ]; then
  exit 1
fi

echo "$VALUE"
exit 0
