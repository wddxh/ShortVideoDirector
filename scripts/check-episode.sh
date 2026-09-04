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
if [ -f "$NOVEL" ]; then
  echo 'novel:ok'
elif [ -f "$SCRIPT_FILE" ] && grep -q '^## 场景' "$SCRIPT_FILE"; then
  echo 'script:ok'
else
  echo 'script:missing'; HAS_ISSUE=1
fi

if [ -f "$OUTLINE" ] && grep -q '^## 本集资产清单' "$OUTLINE"; then
  echo 'asset-list:ok'
else
  echo 'asset-list:missing'; HAS_ISSUE=1
fi

MISSING_ASSETS=''
if [ -f "$OUTLINE" ] && grep -q '^## 本集资产清单' "$OUTLINE"; then
  ASSET_NAMES=$(bash "$SCRIPT_DIR/parse-new-assets.sh" "$OUTLINE" 2>/dev/null)
  while IFS= read -r ASSET_PATH; do
    [ -n "$ASSET_PATH" ] || continue
    NAME=${ASSET_PATH##*/}
    NAME=${NAME%.md}
    [ -f "$ASSET_PATH" ] || MISSING_ASSETS="${MISSING_ASSETS}${MISSING_ASSETS:+,}$NAME"
  done <<EOF
$ASSET_NAMES
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
  for MD in assets/characters/*.md assets/items/*.md assets/locations/*.md assets/buildings/*.md; do
    [ -f "$MD" ] || continue
    IMAGE=$(bash "$SCRIPT_DIR/asset-to-image-path.sh" "$MD")
    [ -f "$IMAGE" ] || MISSING_IMAGES="${MISSING_IMAGES}${MISSING_IMAGES:+,}${MD##*/}"
  done
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

if printf '%s\n' "$SHEET_OUTPUT" | grep -q '^storyboard:invalid:'; then
  :
else
  echo 'storyboard:ok'
fi

exit "$HAS_ISSUE"
