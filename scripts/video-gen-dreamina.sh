#!/usr/bin/env bash
# Submit a single video generation task using Dreamina CLI multimodal2video.
# Does NOT poll — returns submit_id immediately for async tracking.
# Usage: video-gen-dreamina.sh PROMPT OUTPUT IMAGES DURATION RATIO MODEL RESOLUTION
# The complete reference list is forwarded unchanged and in order; provider
# limits are returned as provider errors.
# Exit codes: 0=SUBMITTED (stdout has "SUBMITTED submit_id"), 1=FAIL

if [ $# -ne 7 ]; then
  echo 'Usage: video-gen-dreamina.sh PROMPT OUTPUT IMAGES DURATION RATIO MODEL RESOLUTION'
  exit 1
fi

PROMPT="$1"
OUTPUT="$2"
IMAGES="$3"
DURATION="$4"
RATIO="$5"
MODEL="$6"
RESOLUTION="$7"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case ",$IMAGES," in
  *,,*)
    echo "FAIL images list is empty"
    exit 1
    ;;
esac

TOKEN=$(node "$SCRIPT_DIR/video-task-inputs.mjs" reserve "$PROMPT" "$OUTPUT" "$IMAGES" "$DURATION" "$RATIO" "$MODEL" dreamina "$RESOLUTION")
if [ $? -ne 0 ]; then
  echo "FAIL submission_gate"
  exit 1
fi

# Build --image flags as an array (no eval needed; preserves arbitrary chars
# in PROMPT including double quotes, spaces, shell metachars).
IMAGE_FLAGS=()
IFS=',' read -ra IMG_ARRAY <<< "$IMAGES"
for img in "${IMG_ARRAY[@]}"; do
  IMAGE_FLAGS+=( --image "$img" )
done

# Submit task (no --poll, returns immediately). PROMPT is passed via array,
# so any chars in it (including ", ', spaces, $) are preserved verbatim.
RESULT=$(dreamina multimodal2video \
  "${IMAGE_FLAGS[@]}" \
  --prompt="$PROMPT" \
  --duration="$DURATION" \
  --ratio="$RATIO" \
  --video_resolution="$RESOLUTION" \
  --model_version="$MODEL" 2>&1)
CLI_EXIT=$?

json_field() {
  printf '%s' "$RESULT" | bash "$SCRIPT_DIR/json-string-field.sh" "$1"
}

# Parse gen_status
STATUS=$(json_field gen_status)
SUBMIT_ID=$(json_field submit_id)

# An ID permits recovery even when the CLI exits unsuccessfully after accepting.
if [ -n "$SUBMIT_ID" ]; then
  if ! node "$SCRIPT_DIR/video-task-inputs.mjs" settle "$OUTPUT" "$TOKEN" submitted "$SUBMIT_ID"; then
    echo "FAIL settlement_unknown submit_id=$SUBMIT_ID"
    exit 1
  fi
  echo "SUBMITTED $SUBMIT_ID"
  exit 0
fi
if [ "$CLI_EXIT" -ne 0 ]; then
  echo "$RESULT" >&2
  echo "FAIL submission_unknown"
  exit 1
fi

case "$STATUS" in
  fail)
    REASON=$(json_field fail_reason)
    if ! node "$SCRIPT_DIR/video-task-inputs.mjs" settle "$OUTPUT" "$TOKEN" failed "${REASON:-unknown error}"; then
      echo "FAIL settlement_unknown"
      exit 1
    fi
    echo "FAIL ${REASON:-unknown error}"
    exit 1
    ;;
  *)
    echo "FAIL submission_unknown"
    echo "$RESULT" >&2
    exit 1
    ;;
esac
