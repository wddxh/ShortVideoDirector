#!/usr/bin/env bash
# Generate a single image using Dreamina CLI.
# Usage: bash scripts/image-gen-dreamina.sh "prompt" "output_path" [ratio] [resolution] [model_version] [ref_images]
# Without ref_images: uses text2image (text-to-image)
# With ref_images: uses image2image (reference images + prompt)
#   - Pass single path or comma-separated list (e.g. "a.png,b.png,c.png")
#   - The complete reference list is forwarded unchanged; provider limits are
#     returned as provider errors
# Exit codes: 0=OK, 1=FAIL, 2=PENDING (stdout has "PENDING submit_id")

if [ $# -lt 2 ]; then
  echo "Usage: bash scripts/image-gen-dreamina.sh \"prompt\" \"output_path\" [ratio] [resolution] [model_version] [ref_images]"
  exit 1
fi

PROMPT="$1"
OUTPUT="$2"
RATIO="${3:-1:1}"
RESOLUTION="${4:-2k}"
MODEL="${5:-4.0}"
REF_IMAGES="$6"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
    echo "PENDING $SUBMIT_ID"
    exit 2
    ;;
  *)
    echo "FAIL unexpected status: $STATUS"
    echo "$RESULT" >&2
    exit 1
    ;;
esac
