#!/usr/bin/env bash
# Report episode completeness as item:status[:detail] lines.

set -u

[ "$#" -ge 1 ] && [ "$#" -le 2 ] || {
  printf '%s\n' 'Usage: bash scripts/check-episode.sh ep01 [config_path]'
  exit 1
}

case "$0" in
  */*) SCRIPT_DIR=${0%/*} ;;
  *) SCRIPT_DIR=. ;;
esac
SCRIPT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR" && pwd)
EP=$1
CONFIG=${2:-config.md}
EP_DIR="story/episodes/$EP"
STORYBOARD="$EP_DIR/storyboard.md"
TASKS="$EP_DIR/videos/tasks.json"
HAS_ISSUE=0

"$SCRIPT_DIR/detect-legacy-kf.sh" "$EP" "$STORYBOARD" "$TASKS"
STATUS=$?
[ "$STATUS" -eq 0 ] || exit "$STATUS"

read_config() {
  bash "$SCRIPT_DIR/read-config.sh" "$1" "$CONFIG" 2>/dev/null
}

review_status() {
  REVIEW_FILE=$1
  if [ ! -f "$REVIEW_FILE" ]; then
    printf '%s\n' 'missing'
    return
  fi
  LAST_HEADING=$(awk '/^## 第 [0-9]+ 轮 .* - / { line=$0 } END { print line }' "$REVIEW_FILE")
  ROUND=$(printf '%s\n' "$LAST_HEADING" | sed -nE 's/^## 第 ([0-9]+) 轮 .*/\1/p')
  if [ -n "$ROUND" ] && printf '%s\n' "$LAST_HEADING" | grep -Eq '^## 第 [0-9]+ 轮 .+ - 通过$' \
      && [ "$(grep -c "^<!-- /round-$ROUND -->$" "$REVIEW_FILE")" -eq 1 ]; then
    printf '%s\n' 'ok'
  else
    printf '%s\n' 'needs_revision'
  fi
}

OUTLINE="$EP_DIR/outline.md"
if [ ! -f "$OUTLINE" ]; then
  echo 'outline:missing'; HAS_ISSUE=1
elif grep -q '## 集尾钩子\|## 结局设计' "$OUTLINE"; then
  echo 'outline:ok'
else
  echo 'outline:incomplete'; HAS_ISSUE=1
fi

NOVEL="$EP_DIR/novel.md"
SCRIPT_FILE="$EP_DIR/script.md"
MODE=$(read_config 'mode')
if [ "$MODE" != 'series' ] && [ "$MODE" != 'short' ]; then
  MODE=$(bash "$SCRIPT_DIR/detect-mode.sh" 2>/dev/null)
fi
if [ "$MODE" = 'series' ]; then
  if [ ! -f "$NOVEL" ]; then
    echo 'novel:missing'; HAS_ISSUE=1
  elif [ ! -s "$NOVEL" ]; then
    echo 'novel:incomplete'; HAS_ISSUE=1
  else
    NOVEL_RESULT=$(bash "$SCRIPT_DIR/novel-budget.sh" "$EP" "$CONFIG" 2>/dev/null)
    NOVEL_STATUS=$(printf '%s\n' "$NOVEL_RESULT" | grep '^status:' | cut -d: -f2)
    NOVEL_ACTUAL=$(printf '%s\n' "$NOVEL_RESULT" | grep '^actual:' | cut -d: -f2)
    NOVEL_LOWER=$(printf '%s\n' "$NOVEL_RESULT" | grep '^expected_lower:' | cut -d: -f2)
    if [ "$NOVEL_STATUS" = 'fail' ]; then
      echo "novel:incomplete:${NOVEL_ACTUAL:-0}/${NOVEL_LOWER:-unknown}"; HAS_ISSUE=1
    else
      echo 'novel:ok'
    fi
  fi
fi
if [ ! -f "$SCRIPT_FILE" ]; then
  echo 'script:missing'; HAS_ISSUE=1
elif grep -q '^## 场景' "$SCRIPT_FILE"; then
  echo 'script:ok'
else
  echo 'script:incomplete'; HAS_ISSUE=1
fi

if [ -f "$OUTLINE" ] && grep -q '^## 本集资产清单' "$OUTLINE"; then
  echo 'asset-list:ok'
else
  echo 'asset-list:missing'; HAS_ISSUE=1
fi

MISSING_ASSETS=''
EP_ASSETS=''
if [ -f "$OUTLINE" ] && grep -q '^## 本集资产清单' "$OUTLINE"; then
  EP_ASSETS=$(awk '
    /^## 本集资产清单[[:space:]]*$/ { in_list=1; next }
    in_list && /^## / { exit }
    in_list && /^- (characters|locations|items|buildings):/ {
      type=$0; sub(/^- /, "", type); sub(/:.*/, "", type)
      values=$0; sub(/^- [^:]+:[[:space:]]*/, "", values)
      count=split(values, entries, /,[[:space:]]*/)
      for (i=1; i<=count; i++) {
        value=entries[i]; gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
        if (value == "" || value == "(无)") continue
        marker=index(value, "(assets/")
        if (marker > 0) {
          asset=substr(value, marker+1); sub(/\)[[:space:]]*$/, "", asset); print asset
        } else {
          print "assets/" type "/" value ".md"
        }
      }
    }
  ' "$OUTLINE")
  while IFS= read -r ASSET_PATH; do
    [ -n "$ASSET_PATH" ] || continue
    NAME=${ASSET_PATH##*/}
    NAME=${NAME%.md}
    [ -f "$ASSET_PATH" ] || MISSING_ASSETS="${MISSING_ASSETS}${MISSING_ASSETS:+,}$NAME"
  done <<EOF
$EP_ASSETS
EOF
fi
if [ -n "$MISSING_ASSETS" ]; then
  echo "assets:missing:$MISSING_ASSETS"; HAS_ISSUE=1
else
  echo 'assets:ok'
fi

IMAGE_MODEL=$(read_config '图像模型')
if [ "$IMAGE_MODEL" = 'none' ] || [ -z "$IMAGE_MODEL" ]; then
  echo 'images:skipped'
else
  MISSING_IMAGES=''
  while IFS= read -r MD; do
    [ -f "$MD" ] || continue
    IMAGE=$(bash "$SCRIPT_DIR/asset-to-image-path.sh" "$MD")
    NAME=${MD##*/}
    NAME=${NAME%.md}
    [ -f "$IMAGE" ] || MISSING_IMAGES="${MISSING_IMAGES}${MISSING_IMAGES:+,}$NAME"
  done <<EOF
$EP_ASSETS
EOF
  if [ -n "$MISSING_IMAGES" ]; then
    echo "images:missing:$MISSING_IMAGES"; HAS_ISSUE=1
  else
    echo 'images:ok'
  fi
fi

if [ ! -f "$STORYBOARD" ]; then
  echo 'storyboard:missing'
  echo 'storyboard-sheets:missing'
  if [ "$IMAGE_MODEL" = 'none' ] || [ -z "$IMAGE_MODEL" ]; then
    echo 'storyboard-sheet-images:skipped'
  else
    echo 'storyboard-sheet-images:missing'
  fi
  exit 1
fi

SHEET_OUTPUT=$(node "$SCRIPT_DIR/check-storyboard-sheets.mjs" "$EP" "$IMAGE_MODEL")
SHEET_STATUS=$?
printf '%s\n' "$SHEET_OUTPUT"
[ "$SHEET_STATUS" -eq 0 ] || HAS_ISSUE=1

PROMPT_REVIEW=$(review_status "$EP_DIR/.review-storyboard-sheet-prompts.md")
echo "storyboard-sheet-prompt-review:$PROMPT_REVIEW"
[ "$PROMPT_REVIEW" = 'ok' ] || HAS_ISSUE=1
if [ "$IMAGE_MODEL" = 'none' ] || [ -z "$IMAGE_MODEL" ]; then
  echo 'storyboard-sheet-visual-review:skipped'
else
  VISUAL_REVIEW=$(review_status "$EP_DIR/.review-storyboard-sheets-visual.md")
  echo "storyboard-sheet-visual-review:$VISUAL_REVIEW"
  [ "$VISUAL_REVIEW" = 'ok' ] || HAS_ISSUE=1
fi

if printf '%s\n' "$SHEET_OUTPUT" | grep -Eq '^storyboard:(invalid|incomplete):'; then
  :
else
  echo 'storyboard:ok'
fi

exit "$HAS_ISSUE"
