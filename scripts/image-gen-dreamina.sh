#!/usr/bin/env bash
# Generate a single image using Dreamina CLI text2image.
# Usage: bash scripts/image-gen-dreamina.sh "prompt" "output_path" [ratio] [resolution] [model_version]
# Exit codes: 0=OK, 1=FAIL, 2=PENDING (stdout has "PENDING submit_id")

if [ $# -lt 2 ]; then
  echo "Usage: bash scripts/image-gen-dreamina.sh \"prompt\" \"output_path\" [ratio] [resolution] [model_version]"
  exit 1
fi

PROMPT="$1"
OUTPUT="$2"
RATIO="${3:-1:1}"
RESOLUTION="${4:-2k}"
MODEL="${5:-4.0}"

# Generate image
RESULT=$(dreamina text2image \
  --prompt="$PROMPT" \
  --ratio="$RATIO" \
  --resolution_type="$RESOLUTION" \
  --model_version="$MODEL" \
  --poll=60 2>&1)

# Parse gen_status
STATUS=$(printf '%s' "$RESULT" | grep -o '"gen_status"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"gen_status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

case "$STATUS" in
  success)
    # Extract image_url
    URL=$(printf '%s' "$RESULT" | grep -o '"image_url"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"image_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    if [ -z "$URL" ]; then
      echo "FAIL no image_url in response"
      exit 1
    fi
    # Ensure output directory exists
    mkdir -p "$(dirname "$OUTPUT")"
    # Download
    if curl -fsSL -o "$OUTPUT" "$URL"; then
      echo "OK $OUTPUT"
      exit 0
    else
      echo "FAIL download failed"
      exit 1
    fi
    ;;
  fail)
    REASON=$(printf '%s' "$RESULT" | grep -o '"fail_reason"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"fail_reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    echo "FAIL ${REASON:-unknown error}"
    exit 1
    ;;
  querying)
    SUBMIT_ID=$(printf '%s' "$RESULT" | grep -o '"submit_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"submit_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    echo "PENDING $SUBMIT_ID"
    exit 2
    ;;
  *)
    echo "FAIL unexpected status: $STATUS"
    echo "$RESULT" >&2
    exit 1
    ;;
esac
