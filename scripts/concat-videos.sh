#!/usr/bin/env bash
# Explicit-only concatenation of completed generation tasks in source order.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EP="${1:-}"
[ -n "$EP" ] || { printf '%s\n' 'Usage: concat-videos.sh EP [OUTPUT] [--allow-gaps] [--force]' >&2; exit 1; }
shift
OUTPUT=""
ALLOW_GAPS=0
FORCE=()
for arg in "$@"; do
  case "$arg" in
    --allow-gaps) ALLOW_GAPS=1 ;;
    --force) FORCE=(-y) ;;
    --*) printf 'Unknown option: %s\n' "$arg" >&2; exit 1 ;;
    *) [ -z "$OUTPUT" ] || exit 1; OUTPUT="$arg" ;;
  esac
done
OUTPUT="${OUTPUT:-story/episodes/$EP/$EP.mp4}"
[ ! -e "$OUTPUT" ] || [ "${#FORCE[@]}" -gt 0 ] || { printf '%s\n' 'Output exists; use --force' >&2; exit 1; }
command -v ffmpeg >/dev/null
FILES=$(node "$SCRIPT_DIR/concat-videos.mjs" "$EP" "$ALLOW_GAPS")
LIST=$(mktemp)
trap 'rm -f "$LIST"' EXIT
while IFS= read -r file; do
  [ "$OUTPUT" -ef "$file" ] && { printf '%s\n' 'Output would overwrite an input' >&2; exit 1; }
  # Native ffmpeg.exe needs Windows paths under Git Bash; Unix uses pwd.
  directory=$(cd "$(dirname "$file")" && { pwd -W 2>/dev/null || pwd; })
  absolute="$directory/${file##*/}"
  escaped="${absolute//\'/\'\\\'\'}"
  printf "file '%s'\n" "$escaped" >> "$LIST"
done <<< "$FILES"
ffmpeg -hide_banner -loglevel error "${FORCE[@]}" -f concat -safe 0 -i "$LIST" -c copy "$OUTPUT"
printf 'OK: concatenated generation tasks -> %s\n' "$OUTPUT"
