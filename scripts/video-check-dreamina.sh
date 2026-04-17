#!/usr/bin/env bash
# Query a single video generation task and download if complete.
# Usage: bash scripts/video-check-dreamina.sh {submit_id} {output_path}
# Output (stdout):
#   success   — video downloaded to output_path
#   querying  — still generating
#   fail:{reason} — generation failed
# Exit codes: 0=success/fail (terminal), 1=querying (still in progress), 2=error

if [ $# -lt 2 ]; then
  echo "Usage: bash scripts/video-check-dreamina.sh {submit_id} {output_path}"
  exit 2
fi

SUBMIT_ID="$1"
OUTPUT_PATH="$2"
DOWNLOAD_DIR=$(mktemp -d)

# Query dreamina
RESULT=$(dreamina query_result --submit_id="$SUBMIT_ID" --download_dir="$DOWNLOAD_DIR" 2>&1)
STATUS=$(printf '%s' "$RESULT" | grep -oP '"gen_status"\s*:\s*"(?:[^"\\]|\\.)*"' | head -1 | sed -E 's/^"gen_status"[[:space:]]*:[[:space:]]*"//; s/"$//; s/\\"/"/g; s/\\\\/\\/g')

case "$STATUS" in
  success)
    DL_FILE=$(ls "$DOWNLOAD_DIR"/${SUBMIT_ID}_* 2>/dev/null | head -1)
    if [ -z "$DL_FILE" ]; then
      rm -rf "$DOWNLOAD_DIR"
      echo "fail:download_empty"
      exit 0
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
      echo "fail:move_failed"
      exit 0
    fi
    ;;
  fail)
    REASON=$(printf '%s' "$RESULT" | grep -oP '"fail_reason"\s*:\s*"(?:[^"\\]|\\.)*"' | head -1 | sed -E 's/^"fail_reason"[[:space:]]*:[[:space:]]*"//; s/"$//; s/\\"/"/g; s/\\\\/\\/g')
    rm -rf "$DOWNLOAD_DIR"
    echo "fail:${REASON:-unknown}"
    exit 0
    ;;
  *)
    rm -rf "$DOWNLOAD_DIR"
    echo "querying"
    exit 1
    ;;
esac
