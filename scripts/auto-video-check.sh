#!/usr/bin/env bash
# Check video generation task status, download completed videos.
# Does NOT judge fail reasons or retry — that's the LLM's job.
# Usage: bash scripts/auto-video-check.sh {ep01|all}
# Output: structured status per task file, then summary line
# Exit codes: 0=all tasks done/failed (no submitted/pending_retry), 1=tasks still in progress

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/auto-video-check.sh {ep01|all}"
  exit 1
fi

TARGET="$1"

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

for TASK_FILE in $TASK_FILES; do
  [ ! -f "$TASK_FILE" ] && continue

  EP_DIR=$(dirname "$TASK_FILE")
  VIDEO_DIR="$EP_DIR"
  TMP_DIR="$VIDEO_DIR/tmp"
  EP_NAME=$(echo "$EP_DIR" | grep -oE 'ep[0-9]+')

  echo "=== $EP_NAME ==="

  # Step 1: Sync existing video files into tasks.json
  for mp4 in "$VIDEO_DIR"/shot*.mp4; do
    [ ! -f "$mp4" ] && continue
    SHOT_NUM=$(basename "$mp4" .mp4 | sed 's/shot0*//')
    [ -z "$SHOT_NUM" ] && continue
    if ! grep -q "\"shot\"[[:space:]]*:[[:space:]]*$SHOT_NUM[^0-9]" "$TASK_FILE" 2>/dev/null; then
      bash scripts/task-status.sh upsert "$TASK_FILE" "$SHOT_NUM" "{\"shot\":$SHOT_NUM,\"submit_id\":\"\",\"status\":\"done\",\"prompt\":\"\",\"images\":\"\",\"duration\":0,\"fail_reason\":\"\"}"
      echo "SYNCED:shot${SHOT_NUM}:done"
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
        SHOT_NUM=$(grep -B5 "\"$SUBMIT_ID\"" "$TASK_FILE" | grep -oE '"shot"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+' | head -1)
        if [ -n "$SHOT_NUM" ] && [ -n "$DETAIL" ]; then
          SHOT_PADDED=$(printf "shot%02d.mp4" "$SHOT_NUM")
          mv "$DETAIL" "$VIDEO_DIR/$SHOT_PADDED" 2>/dev/null
          bash scripts/task-status.sh update "$TASK_FILE" "$SUBMIT_ID" "done"
          echo "DONE:shot${SHOT_NUM}"
        fi
        ;;
      fail)
        SHOT_NUM=$(grep -B5 "\"$SUBMIT_ID\"" "$TASK_FILE" | grep -oE '"shot"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+' | head -1)
        # Update status to failed and record fail_reason via sed
        bash scripts/task-status.sh update "$TASK_FILE" "$SUBMIT_ID" "failed"
        # Write fail_reason into the entry
        sed -i "/${SUBMIT_ID}/,/\"fail_reason\"/{s/\"fail_reason\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"fail_reason\": \"${DETAIL}\"/}" "$TASK_FILE"
        echo "FAILED:shot${SHOT_NUM}:${DETAIL}"
        ;;
      querying)
        SHOT_NUM=$(grep -B5 "\"$SUBMIT_ID\"" "$TASK_FILE" | grep -oE '"shot"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+' | head -1)
        echo "QUERYING:shot${SHOT_NUM}"
        ;;
    esac
  done <<< "$QUERY_OUTPUT"

  # Clean up tmp dir
  rm -rf "$TMP_DIR"
done

# Final summary: count across all files
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

echo "---"
echo "SUMMARY DONE:$FINAL_DONE SUBMITTED:$FINAL_SUBMITTED FAILED:$FINAL_FAILED PENDING_RETRY:$FINAL_PENDING"

# Exit 0 if no submitted or pending_retry remaining
if [ "$FINAL_SUBMITTED" -eq 0 ] && [ "$FINAL_PENDING" -eq 0 ]; then
  exit 0
else
  exit 1
fi
