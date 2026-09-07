#!/usr/bin/env bash
# Generate a single image using Dreamina CLI.
# Usage: image-gen-dreamina.sh [--force] [--retry-missing-id] PROMPT OUTPUT RATIO RESOLUTION MODEL REFS SOURCE
# Without ref_images: uses text2image (text-to-image)
# With ref_images: uses image2image (reference images + prompt)
#   - Pass single path or comma-separated list (e.g. "a.png,b.png,c.png")
#   - The complete reference list is forwarded unchanged; provider limits are
#     returned as provider errors
# Exit codes: 0=OK, 1=FAIL, 2=PENDING (stdout has "PENDING submit_id")

FORCE=false
RETRY_MISSING_ID=false
while [ $# -gt 7 ] && [[ "${1:-}" == --* ]]; do
  case "$1" in
    --force) FORCE=true ;;
    --retry-missing-id) RETRY_MISSING_ID=true ;;
    *) echo "FAIL unknown option: $1"; exit 1 ;;
  esac
  shift
done

if [ $# -ne 7 ]; then
  echo 'Usage: image-gen-dreamina.sh [--force] [--retry-missing-id] PROMPT OUTPUT RATIO RESOLUTION MODEL REFS SOURCE'
  exit 1
fi

PROMPT="$1"
OUTPUT="$2"
RATIO="$3"
RESOLUTION="$4"
MODEL="$5"
REF_IMAGES="$6"
ASSET_PATH="$7"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PENDING_STATE="$SCRIPT_DIR/image-pending-state.mjs"
RECEIPT="$SCRIPT_DIR/image-generation-record.mjs"

if [ -z "${PROMPT//[[:space:]]/}" ]; then
  echo 'FAIL empty prompt'
  exit 1
fi

# A claim is never queued or expired: an interrupted owner needs reconciliation.
CLAIM="${OUTPUT}.claim"
mkdir -p -- "$(dirname -- "$OUTPUT")" || exit 1
if ! mkdir -- "$CLAIM" 2>/dev/null; then
  echo "FAIL output claim exists: $OUTPUT; reconcile owner before retry"
  exit 1
fi
trap 'rmdir -- "$CLAIM"' EXIT

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

node "$SCRIPT_DIR/local-reference.mjs" validate-asset "$ASSET_PATH" "$REF_IMAGES" >/dev/null || exit 1
ACTION=''
"$RETRY_MISSING_ID" && ACTION='retry-'
CHECK=$(node "$RECEIPT" "${ACTION}check" "$ASSET_PATH" "$OUTPUT" dreamina "$MODEL" "$RATIO" "$RESOLUTION") || exit 1
if ! "$FORCE" && [ "$CHECK" = SKIP ]; then
  echo "SKIP $OUTPUT"
  exit 0
fi
node "$SCRIPT_DIR/image-reference-check.mjs" "$REF_IMAGES" || exit 1
node "$RECEIPT" "${ACTION}prepare" "$ASSET_PATH" "$OUTPUT" dreamina "$MODEL" "$RATIO" "$RESOLUTION" || exit 1
"$FORCE" && rm -f -- "$OUTPUT"

fail() {
  echo "FAIL $1${SUBMIT_ID:+; submit_id=$SUBMIT_ID; reconcile $OUTPUT}"
  exit 1
}

settle() {
  node "$RECEIPT" settle "$OUTPUT" "$1" "${SUBMIT_ID:-}" || fail "cannot settle receipt ($1)"
}

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
    --generate_num=1 \
    --poll=0 2>&1)
else
  # text2image mode: text only
  RESULT=$(dreamina text2image \
    --prompt="$PROMPT" \
    --ratio="$RATIO" \
    --resolution_type="$RESOLUTION" \
    --model_version="$MODEL" \
    --generate_num=1 \
    --poll=0 2>&1)
fi

# Parse gen_status
STATUS=$(json_field gen_status)
SUBMIT_ID=$(json_field submit_id)
if [ -z "${SUBMIT_ID//[[:space:]]/}" ]; then
  SUBMIT_ID=''
fi

# Save the received identity before download or any further provider operation.
if [ "$STATUS" != fail ]; then
  if [ -z "$SUBMIT_ID" ]; then
    printf '%s' "$RESULT" | node "$RECEIPT" missing-id "$OUTPUT" || fail 'cannot save missing-ID evidence'
    fail 'no submit_id in response; outcome unknown'
  fi
  settle received
  node "$PENDING_STATE" upsert "$SUBMIT_ID" "$ASSET_PATH" \
    "$OUTPUT" basic-asset dreamina "$MODEL" "$RATIO" "$RESOLUTION" || fail 'cannot persist pending'
fi

# A bare acceptance is not completion. The ID is durable before this query.
if [ -n "$SUBMIT_ID" ] && [ -z "$STATUS" ]; then
  RESULT=$(dreamina query_result --submit_id="$SUBMIT_ID" 2>&1)
  QUERY_EXIT=$?
  STATUS=$(json_field gen_status)
  if [ "$QUERY_EXIT" -ne 0 ]; then
    settle unknown
    fail "query failed: $RESULT"
  fi
fi

case "$STATUS" in
  success)
    URL=$(json_field image_url)
    if [ -z "$URL" ]; then
      settle unknown
      fail 'no image_url in response'
    fi
    mkdir -p "$(dirname "$OUTPUT")"
    if curl -fsSL -o "$OUTPUT" "$URL"; then
      settle done
      node "$PENDING_STATE" remove "$OUTPUT" "$SUBMIT_ID" || fail 'cannot remove pending'
      echo "OK $OUTPUT"
      exit 0
    else
      settle unknown
      fail 'download failed'
    fi
    ;;
  fail)
    settle failed
    if [ -n "$SUBMIT_ID" ]; then
      node "$PENDING_STATE" remove "$OUTPUT" "$SUBMIT_ID" || fail 'cannot remove terminal pending'
    fi
    REASON=$(json_field fail_reason)
    fail "${REASON:-unknown error}"
    ;;
  querying)
    settle pending
    echo "PENDING $SUBMIT_ID"
    exit 2
    ;;
  *)
    settle unknown
    echo "$RESULT" >&2
    fail "unexpected status: $STATUS"
    ;;
esac
