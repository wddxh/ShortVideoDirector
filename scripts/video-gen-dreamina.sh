#!/usr/bin/env bash
# Submit a single video generation task using Dreamina CLI multimodal2video.
# Does NOT poll — returns submit_id immediately for async tracking.
# Usage: bash scripts/video-gen-dreamina.sh "prompt" "output_path" "img1,img2,..." "duration" [ratio] [model_version]
# The complete reference list is forwarded unchanged and in order; provider
# limits are returned as provider errors.
# Exit codes: 0=SUBMITTED (stdout has "SUBMITTED submit_id"), 1=FAIL

# grep -P (PCRE) requires a UTF-8 or C locale. Force it to avoid silent
# "grep: -P supports only unibyte and UTF-8 locales" on systems with legacy locale.
export LC_ALL=C.UTF-8

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

if [ -z "$IMAGES" ]; then
  echo "FAIL images list is empty"
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
  --video_resolution=720p \
  --model_version="$MODEL" 2>&1)

# Parse gen_status
STATUS=$(printf '%s' "$RESULT" | grep -oP '"gen_status"\s*:\s*"(?:[^"\\]|\\.)*"' | head -1 | sed -E 's/^"gen_status"[[:space:]]*:[[:space:]]*"//; s/"$//; s/\\"/"/g; s/\\\\/\\/g')

case "$STATUS" in
  fail)
    REASON=$(printf '%s' "$RESULT" | grep -oP '"fail_reason"\s*:\s*"(?:[^"\\]|\\.)*"' | head -1 | sed -E 's/^"fail_reason"[[:space:]]*:[[:space:]]*"//; s/"$//; s/\\"/"/g; s/\\\\/\\/g')
    echo "FAIL ${REASON:-unknown error}"
    exit 1
    ;;
  *)
    # Any non-fail status (querying, success, etc.) means submission succeeded
    SUBMIT_ID=$(printf '%s' "$RESULT" | grep -oP '"submit_id"\s*:\s*"(?:[^"\\]|\\.)*"' | head -1 | sed -E 's/^"submit_id"[[:space:]]*:[[:space:]]*"//; s/"$//; s/\\"/"/g; s/\\\\/\\/g')
    if [ -z "$SUBMIT_ID" ]; then
      echo "FAIL no submit_id in response"
      echo "$RESULT" >&2
      exit 1
    fi
    echo "SUBMITTED $SUBMIT_ID"
    exit 0
    ;;
esac
