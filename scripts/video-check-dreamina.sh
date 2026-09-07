#!/usr/bin/env bash
# Query a single video generation task and download if complete.
# Usage: bash scripts/video-check-dreamina.sh {submit_id} {output_path}
# Output (stdout):
#   success   — video downloaded to output_path
#   querying  — still generating
#   fail:{reason} — generation failed
#   error:{reason} — query/download error; retain submitted and submit_id
# Exit codes: 0=success/fail (terminal), 1=querying (still in progress), 2=error

if [ $# -lt 2 ]; then
  echo "Usage: bash scripts/video-check-dreamina.sh {submit_id} {output_path}"
  exit 2
fi

SUBMIT_ID="$1"
OUTPUT_PATH="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOWNLOAD_DIR=$(mktemp -d) || { echo "error:temp_failed"; exit 2; }
trap 'rm -rf "$DOWNLOAD_DIR"' EXIT

# Query dreamina
RESULT=$(dreamina query_result --submit_id="$SUBMIT_ID" --download_dir="$DOWNLOAD_DIR" 2>&1)
if [ $? -ne 0 ]; then
  echo "$RESULT" >&2
  echo "error:cli_failed"
  exit 2
fi
STATUS=$(printf '%s' "$RESULT" | bash "$SCRIPT_DIR/json-string-field.sh" gen_status)

case "$STATUS" in
  success)
    DL_FILE=""
    for candidate in "$DOWNLOAD_DIR/${SUBMIT_ID}_"*; do
      if [ -s "$candidate" ] && [ -f "$candidate" ]; then
        DL_FILE="$candidate"
        break
      fi
    done
    if [ -z "$DL_FILE" ]; then
      rm -rf "$DOWNLOAD_DIR"
      echo "error:download_empty"
      exit 2
    fi
    # Retry mv up to 3 times
    MOVE_OK=false
    for _retry in 1 2 3; do
      if mv "$DL_FILE" "$OUTPUT_PATH" 2>/dev/null && [ -f "$OUTPUT_PATH" ]; then
        MOVE_OK=true
        break
      fi
      sleep 1
    done
    rm -rf "$DOWNLOAD_DIR"
    if [ "$MOVE_OK" = true ]; then
      echo "success"
      exit 0
    else
      echo "error:move_failed"
      exit 2
    fi
    ;;
  fail)
    REASON=$(printf '%s' "$RESULT" | bash "$SCRIPT_DIR/json-string-field.sh" fail_reason)
    rm -rf "$DOWNLOAD_DIR"
    echo "fail:${REASON:-unknown}"
    exit 0
    ;;
  querying)
    rm -rf "$DOWNLOAD_DIR"
    echo "querying"
    exit 1
    ;;
  *)
    echo "error:invalid_status"
    exit 2
    ;;
esac
