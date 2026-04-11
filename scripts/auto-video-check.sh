#!/usr/bin/env bash
# Check video generation task status, download completed videos, retry rate-limited tasks.
# Usage: bash scripts/auto-video-check.sh {ep01|all}
# Exit codes: 0=all tasks done (cron should stop), 1=tasks still in progress

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/auto-video-check.sh {ep01|all}"
  exit 1
fi

TARGET="$1"
TOTAL_DONE=0
TOTAL_SUBMITTED=0
TOTAL_FAILED=0
TOTAL_RETRIED=0
HAS_PENDING=0

# Determine target task files
if [ "$TARGET" = "all" ]; then
  TASK_FILES=$(ls story/episodes/*/videos/tasks.json 2>/dev/null)
else
  TASK_FILES="story/episodes/$TARGET/videos/tasks.json"
fi

if [ -z "$TASK_FILES" ]; then
  echo "NO_TASKS"
  exit 0
fi

# Read video config
VIDEO_MODEL_VERSION=$(bash scripts/read-config.sh "即梦视频模型版本" 2>/dev/null)
VIDEO_RATIO=$(bash scripts/read-config.sh "视频比例" 2>/dev/null)
VIDEO_MODEL_VERSION="${VIDEO_MODEL_VERSION:-seedance2.0fast}"
VIDEO_RATIO="${VIDEO_RATIO:-16:9}"

for TASK_FILE in $TASK_FILES; do
  [ ! -f "$TASK_FILE" ] && continue

  EP_DIR=$(dirname "$TASK_FILE")
  VIDEO_DIR="$EP_DIR"
  TMP_DIR="$VIDEO_DIR/tmp"

  # Step 1: Sync existing video files into tasks.json
  for mp4 in "$VIDEO_DIR"/shot*.mp4; do
    [ ! -f "$mp4" ] && continue
    # Extract shot number from filename: shot01.mp4 -> 1, shot12.mp4 -> 12
    SHOT_NUM=$(basename "$mp4" .mp4 | sed 's/shot0*//')
    [ -z "$SHOT_NUM" ] && continue
    # Check if this shot exists in tasks.json
    if ! grep -q "\"shot\"[[:space:]]*:[[:space:]]*$SHOT_NUM[^0-9]" "$TASK_FILE" 2>/dev/null; then
      bash scripts/task-status.sh upsert "$TASK_FILE" "$SHOT_NUM" "{\"shot\":$SHOT_NUM,\"submit_id\":\"\",\"status\":\"done\",\"prompt\":\"\",\"images\":\"\",\"duration\":0,\"fail_reason\":\"\"}"
    fi
  done

  # Step 2: Query submitted tasks
  QUERY_OUTPUT=$(bash scripts/task-status.sh query "$TASK_FILE" "$TMP_DIR" 2>/dev/null)

  while IFS= read -r line; do
    [ -z "$line" ] && continue
    SUBMIT_ID=$(echo "$line" | cut -d: -f1)
    STATUS=$(echo "$line" | cut -d: -f2)
    DETAIL=$(echo "$line" | cut -d: -f3-)

    case "$STATUS" in
      success)
        # Find the shot number for this submit_id
        SHOT_NUM=$(grep -B5 "\"$SUBMIT_ID\"" "$TASK_FILE" | grep -oE '"shot"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+' | head -1)
        if [ -n "$SHOT_NUM" ] && [ -n "$DETAIL" ]; then
          SHOT_PADDED=$(printf "shot%02d.mp4" "$SHOT_NUM")
          mv "$DETAIL" "$VIDEO_DIR/$SHOT_PADDED" 2>/dev/null
          bash scripts/task-status.sh update "$TASK_FILE" "$SUBMIT_ID" "done"
        fi
        TOTAL_DONE=$((TOTAL_DONE + 1))
        ;;
      fail)
        # Check if it's a rate limit / concurrency error
        if echo "$DETAIL" | grep -qiE 'rate_limit|concurrent|too_many_requests|queue_full|throttl'; then
          bash scripts/task-status.sh update "$TASK_FILE" "$SUBMIT_ID" "pending_retry"
          HAS_PENDING=1
        else
          bash scripts/task-status.sh update "$TASK_FILE" "$SUBMIT_ID" "failed"
        fi
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        ;;
      querying)
        TOTAL_SUBMITTED=$((TOTAL_SUBMITTED + 1))
        ;;
    esac
  done <<< "$QUERY_OUTPUT"

  # Step 3: Scan failed tasks for rate-limit errors, convert to pending_retry
  # This catches tasks that failed on first submission (never were "submitted")
  FAILED_IDS=$(grep -B2 '"failed"' "$TASK_FILE" 2>/dev/null | grep -oE '"submit_id"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')
  for FID in $FAILED_IDS; do
    [ -z "$FID" ] && continue
    # Check fail_reason for this entry
    FR=$(awk -v id="$FID" '
      $0 ~ id { found=1 }
      found && /\"fail_reason\"/ {
        match($0, /"fail_reason"[[:space:]]*:[[:space:]]*"([^"]*)"/, arr)
        if (arr[1] != "") print arr[1]
        found=0
      }
    ' "$TASK_FILE")
    if echo "$FR" | grep -qiE 'rate_limit|concurrent|too_many_requests|queue_full|throttl'; then
      bash scripts/task-status.sh update "$TASK_FILE" "$FID" "pending_retry"
    fi
  done

  # Step 4: Retry pending_retry tasks
  # Extract pending_retry entries and try to resubmit
  PENDING_IDS=$(grep -B2 '"pending_retry"' "$TASK_FILE" 2>/dev/null | grep -oE '"submit_id"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')

  for OLD_ID in $PENDING_IDS; do
    [ -z "$OLD_ID" ] && continue

    # Extract stored prompt, images, duration for this entry
    # Find shot number first
    SHOT_NUM=$(grep -B5 "\"$OLD_ID\"" "$TASK_FILE" | grep -oE '"shot"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+' | head -1)
    [ -z "$SHOT_NUM" ] && continue

    # Extract prompt (between "prompt": " and next ")
    PROMPT=$(awk -v id="$OLD_ID" '
      $0 ~ id { found=1 }
      found && /\"prompt\"/ {
        match($0, /"prompt"[[:space:]]*:[[:space:]]*"([^"]*)"/, arr)
        if (arr[1] != "") print arr[1]
        found=0
      }
    ' "$TASK_FILE")

    IMAGES=$(awk -v id="$OLD_ID" '
      $0 ~ id { found=1 }
      found && /\"images\"/ {
        match($0, /"images"[[:space:]]*:[[:space:]]*"([^"]*)"/, arr)
        if (arr[1] != "") print arr[1]
        found=0
      }
    ' "$TASK_FILE")

    DURATION=$(awk -v id="$OLD_ID" '
      $0 ~ id { found=1 }
      found && /\"duration\"/ {
        match($0, /"duration"[[:space:]]*:[[:space:]]*([0-9]+)/, arr)
        if (arr[1] != "") print arr[1]
        found=0
      }
    ' "$TASK_FILE")

    [ -z "$PROMPT" ] || [ -z "$IMAGES" ] && continue
    DURATION="${DURATION:-5}"

    SHOT_PADDED=$(printf "shot%02d.mp4" "$SHOT_NUM")
    OUTPUT="$VIDEO_DIR/$SHOT_PADDED"

    # Try to submit
    RESULT=$(bash scripts/video-gen-dreamina.sh "$PROMPT" "$OUTPUT" "$IMAGES" "$DURATION" "$VIDEO_RATIO" "$VIDEO_MODEL_VERSION" 2>&1)
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
      NEW_ID=$(echo "$RESULT" | sed 's/SUBMITTED //')
      bash scripts/task-status.sh upsert "$TASK_FILE" "$SHOT_NUM" "{\"shot\":$SHOT_NUM,\"submit_id\":\"$NEW_ID\",\"status\":\"submitted\",\"prompt\":\"$(echo "$PROMPT" | sed 's/"/\\"/g')\",\"images\":\"$IMAGES\",\"duration\":$DURATION,\"fail_reason\":\"\"}"
      TOTAL_RETRIED=$((TOTAL_RETRIED + 1))
    else
      # Check if rate limited again
      FAIL_MSG=$(echo "$RESULT" | sed 's/FAIL //')
      if echo "$FAIL_MSG" | grep -qiE 'rate_limit|concurrent|too_many_requests|queue_full|throttl'; then
        # Hit limit, stop retrying remaining tasks
        break
      else
        bash scripts/task-status.sh update "$TASK_FILE" "$OLD_ID" "failed"
      fi
    fi
  done

  # Clean up tmp dir
  rm -rf "$TMP_DIR"
done

# Step 6: Count final status across all files
FINAL_DONE=0
FINAL_SUBMITTED=0
FINAL_FAILED=0
FINAL_PENDING=0

for TASK_FILE in $TASK_FILES; do
  [ ! -f "$TASK_FILE" ] && continue
  FINAL_DONE=$((FINAL_DONE + $(grep -c '"done"' "$TASK_FILE" 2>/dev/null)))
  FINAL_SUBMITTED=$((FINAL_SUBMITTED + $(grep -c '"submitted"' "$TASK_FILE" 2>/dev/null)))
  FINAL_FAILED=$((FINAL_FAILED + $(grep -c '"failed"' "$TASK_FILE" 2>/dev/null)))
  FINAL_PENDING=$((FINAL_PENDING + $(grep -c '"pending_retry"' "$TASK_FILE" 2>/dev/null)))
done

echo "DONE:$FINAL_DONE SUBMITTED:$FINAL_SUBMITTED FAILED:$FINAL_FAILED PENDING_RETRY:$FINAL_PENDING RETRIED:$TOTAL_RETRIED"

# Exit 0 if all done (no submitted or pending_retry remaining)
if [ "$FINAL_SUBMITTED" -eq 0 ] && [ "$FINAL_PENDING" -eq 0 ]; then
  exit 0
else
  exit 1
fi
