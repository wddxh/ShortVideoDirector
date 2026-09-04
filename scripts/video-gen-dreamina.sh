#!/usr/bin/env bash
# Submit a single video generation task using Dreamina CLI multimodal2video.
# Does NOT poll — returns submit_id immediately for async tracking.
# Usage: bash scripts/video-gen-dreamina.sh "prompt" "output_path" "img1,img2,..." "duration" [ratio] [model_version]
# The complete reference list is forwarded unchanged and in order; provider
# limits are returned as provider errors.
# Exit codes: 0=SUBMITTED (stdout has "SUBMITTED submit_id"), 1=FAIL

if [ $# -lt 4 ]; then
  echo "Usage: bash scripts/video-gen-dreamina.sh \"prompt\" \"output_path\" \"img1,img2,...\" \"duration\" [ratio] [model_version]"
  exit 1
fi

PROMPT="$1"
OUTPUT="$2"
IMAGES="$3"
DURATION="$4"
RATIO="${5:-16:9}"
MODEL="${6:-seedance2.0fast}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case ",$IMAGES," in
  *,,*)
    echo "FAIL images list is empty"
    exit 1
    ;;
esac

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
  --video_resolution=720p \
  --model_version="$MODEL" 2>&1)

json_field() {
  printf '%s' "$RESULT" | bash "$SCRIPT_DIR/json-string-field.sh" "$1"
}

# Parse gen_status
STATUS=$(json_field gen_status)

case "$STATUS" in
  fail)
    REASON=$(json_field fail_reason)
    echo "FAIL ${REASON:-unknown error}"
    exit 1
    ;;
  *)
    # Any non-fail status (querying, success, etc.) means submission succeeded
    SUBMIT_ID=$(json_field submit_id)
    if [ -z "$SUBMIT_ID" ]; then
      echo "FAIL no submit_id in response"
      echo "$RESULT" >&2
      exit 1
    fi
    echo "SUBMITTED $SUBMIT_ID"
    exit 0
    ;;
esac
