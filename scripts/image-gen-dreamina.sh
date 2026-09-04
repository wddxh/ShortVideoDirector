#!/usr/bin/env bash
# Generate a single image using Dreamina CLI.
# Usage: bash scripts/image-gen-dreamina.sh [--force] "prompt" "output_path" [ratio] [resolution] [model_version] [ref_images] [asset_path]
# Without ref_images: uses text2image (text-to-image)
# With ref_images: uses image2image (reference images + prompt)
#   - Pass single path or comma-separated list (e.g. "a.png,b.png,c.png")
#   - The complete reference list is forwarded unchanged; provider limits are
#     returned as provider errors
# Exit codes: 0=OK, 1=FAIL, 2=PENDING (stdout has "PENDING submit_id")

FORCE=false
if [ "${1:-}" = '--force' ]; then
  FORCE=true
  shift
fi

if [ $# -lt 2 ]; then
  echo "Usage: bash scripts/image-gen-dreamina.sh [--force] \"prompt\" \"output_path\" [ratio] [resolution] [model_version] [ref_images] [asset_path]"
  exit 1
fi

PROMPT="$1"
OUTPUT="$2"
RATIO="${3:-1:1}"
RESOLUTION="${4:-2k}"
MODEL="${5:-4.0}"
REF_IMAGES="$6"
ASSET_PATH="$7"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PENDING_STATE="$SCRIPT_DIR/image-pending-state.mjs"

if [ -n "$ASSET_PATH" ]; then
  EXISTING_PENDING=$(node "$PENDING_STATE" get "$OUTPUT" 2>/dev/null)
  PENDING_STATUS=$?
  if [ "$PENDING_STATUS" -eq 0 ]; then
    echo "PENDING $(printf '%s\n' "$EXISTING_PENDING" | cut -d' ' -f2)"
    exit 2
  elif [ "$PENDING_STATUS" -ne 1 ]; then
    echo "FAIL cannot read pending state"
    exit 1
  fi
fi

"$FORCE" && rm -f -- "$OUTPUT"

json_field() {
  printf '%s' "$RESULT" | bash "$SCRIPT_DIR/json-string-field.sh" "$1"
}

# Generate image
if [ -n "$REF_IMAGES" ]; then
  # image2image mode: pass reference images as one comma-separated argument
  RESULT=$(dreamina image2image \
    --images "$REF_IMAGES" \
    --prompt="$PROMPT" \
    --ratio="$RATIO" \
    --resolution_type="$RESOLUTION" \
    --model_version="$MODEL" \
    --poll=60 2>&1)
else
  # text2image mode: text only
  RESULT=$(dreamina text2image \
    --prompt="$PROMPT" \
    --ratio="$RATIO" \
    --resolution_type="$RESOLUTION" \
    --model_version="$MODEL" \
    --poll=60 2>&1)
fi

# Parse gen_status
STATUS=$(json_field gen_status)

case "$STATUS" in
  success)
    URL=$(json_field image_url)
    if [ -z "$URL" ]; then
      echo "FAIL no image_url in response"
      exit 1
    fi
    mkdir -p "$(dirname "$OUTPUT")"
    if curl -fsSL -o "$OUTPUT" "$URL"; then
      echo "OK $OUTPUT"
      exit 0
    else
      echo "FAIL download failed"
      exit 1
    fi
    ;;
  fail)
    REASON=$(json_field fail_reason)
    echo "FAIL ${REASON:-unknown error}"
    exit 1
    ;;
  querying)
    SUBMIT_ID=$(json_field submit_id)
    if [ -n "$ASSET_PATH" ]; then
      case "$ASSET_PATH" in
        assets/storyboard-sheets/*) PENDING_TYPE=storyboard-sheet ;;
        *) PENDING_TYPE=basic-asset ;;
      esac
      if ! node "$PENDING_STATE" upsert "$SUBMIT_ID" "$ASSET_PATH" \
          "$OUTPUT" "$PENDING_TYPE"; then
        echo "FAIL cannot persist pending"
        exit 1
      fi
    fi
    echo "PENDING $SUBMIT_ID"
    exit 2
    ;;
  *)
    echo "FAIL unexpected status: $STATUS"
    echo "$RESULT" >&2
    exit 1
    ;;
esac
