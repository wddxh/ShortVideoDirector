#!/usr/bin/env bash
# Submit a single video generation task using Dreamina CLI multimodal2video.
# Does NOT poll — returns submit_id immediately for async tracking.
# Usage: bash scripts/video-gen-dreamina.sh "prompt" "output_path" "img1,img2,..." "duration" [ratio] [model_version]
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

# Build --image flags from comma-separated list
IMAGE_FLAGS=""
IFS=',' read -ra IMG_ARRAY <<< "$IMAGES"
for img in "${IMG_ARRAY[@]}"; do
  IMAGE_FLAGS="$IMAGE_FLAGS --image $img"
done

# Submit task (no --poll, returns immediately)
RESULT=$(eval dreamina multimodal2video \
  $IMAGE_FLAGS \
  --prompt="\"$PROMPT\"" \
  --duration="$DURATION" \
  --ratio="$RATIO" \
  --video_resolution=720p \
  --model_version="$MODEL" 2>&1)

# Parse gen_status
STATUS=$(printf '%s' "$RESULT" | grep -o '"gen_status"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"gen_status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

case "$STATUS" in
  fail)
    REASON=$(printf '%s' "$RESULT" | grep -o '"fail_reason"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"fail_reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    echo "FAIL ${REASON:-unknown error}"
    exit 1
    ;;
  *)
    # Any non-fail status (querying, success, etc.) means submission succeeded
    SUBMIT_ID=$(printf '%s' "$RESULT" | grep -o '"submit_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"submit_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    if [ -z "$SUBMIT_ID" ]; then
      echo "FAIL no submit_id in response"
      echo "$RESULT" >&2
      exit 1
    fi
    echo "SUBMITTED $SUBMIT_ID"
    exit 0
    ;;
esac
