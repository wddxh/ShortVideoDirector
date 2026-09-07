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
SCRIPT_FILE="$EP_DIR/script.md"
HAS_ISSUE=0

"$SCRIPT_DIR/detect-legacy-kf.sh" "$EP" "$STORYBOARD" "$EP_DIR/videos/tasks.json"
STATUS=$?
[ "$STATUS" -eq 0 ] || exit "$STATUS"

if [ ! -f "$SCRIPT_FILE" ]; then
  printf '%s\n' 'script:missing'; HAS_ISSUE=1
elif grep -q '^## 场景' "$SCRIPT_FILE"; then
  printf '%s\n' 'script:ok'
else
  printf '%s\n' 'script:incomplete'; HAS_ISSUE=1
fi

EP_ASSETS=$(node "$SCRIPT_DIR/episode-assets.mjs" "$SCRIPT_FILE" all)
if [ "$?" -ne 0 ]; then
  printf '%s\n' 'asset-list:missing' 'assets:unknown' 'images:unknown'
  HAS_ISSUE=1
else
  printf '%s\n' 'asset-list:ok'
  MISSING_ASSETS=''
  MISSING_IMAGES=''
  while IFS= read -r MD; do
    [ -n "$MD" ] || continue
    NAME=${MD##*/}
    NAME=${NAME%.md}
    [ -f "$MD" ] || MISSING_ASSETS="${MISSING_ASSETS}${MISSING_ASSETS:+,}$NAME"
    IMAGE=$(bash "$SCRIPT_DIR/asset-to-image-path.sh" "$MD")
    if [ ! -f "$MD" ] || [ ! -f "$IMAGE" ]; then
      MISSING_IMAGES="${MISSING_IMAGES}${MISSING_IMAGES:+,}$NAME"
    fi
  done <<< "$EP_ASSETS"
  if [ -n "$MISSING_ASSETS" ]; then
    printf 'assets:missing:%s\n' "$MISSING_ASSETS"; HAS_ISSUE=1
  else
    printf '%s\n' 'assets:ok'
  fi
  if [ -n "$MISSING_IMAGES" ]; then
    printf 'images:missing:%s\n' "$MISSING_IMAGES"; HAS_ISSUE=1
  else
    printf '%s\n' 'images:ok'
  fi
fi

if [ ! -f "$STORYBOARD" ]; then
  printf '%s\n' 'storyboard:missing' 'storyboard-sheets:missing' 'storyboard-sheet-images:missing'
  HAS_ISSUE=1
else
  SHEET_OUTPUT=$(node "$SCRIPT_DIR/check-storyboard-sheets.mjs" "$EP")
  [ "$?" -eq 0 ] || HAS_ISSUE=1
  printf '%s\n' "$SHEET_OUTPUT"
  if ! printf '%s\n' "$SHEET_OUTPUT" | grep -Eq '^storyboard:(invalid|incomplete):'; then
    printf '%s\n' 'storyboard:ok'
  fi
fi
SVD_CONFIG="$CONFIG" node "$SCRIPT_DIR/review-evidence.mjs" check "$EP"
[ "$?" -eq 0 ] || HAS_ISSUE=1
exit "$HAS_ISSUE"
