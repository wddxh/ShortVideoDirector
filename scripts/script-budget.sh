#!/usr/bin/env bash
# Diagnose full-scene word-count density against per-scene 目标时长, not artistic quality.
# Usage: bash scripts/script-budget.sh <ep> [config_path]
# Reads story/episodes/<ep>/script.md from project cwd; optional config_path is ignored.
# Output:
#   scene:N:title=...:duration=D:actual=X:expected_lower=L:expected_upper=U:status=ok/warn
#   scene:N:title=...:duration=0:actual=0:expected_lower=0:expected_upper=0:status=missing:duration
#   summary:total_actual=...:total_expected_lower=...:total_expected_upper=...:scene_count=...:scenes_warn=...:scenes_ok=...:scenes_missing=...:status=missing/warn/ok
#   status:missing:script or status:missing:scenes when input is unavailable.
# Exit code: 0 for all diagnostics, including missing input; 1 for missing episode argument.

set -u
SCRIPT_DIR=$(dirname -- "${BASH_SOURCE[0]}")

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/script-budget.sh <ep> [config_path]" >&2
  exit 1
fi

EP="$1"
EP_DIR="story/episodes/$EP"
SCRIPT_FILE="$EP_DIR/script.md"

if [ ! -f "$SCRIPT_FILE" ]; then
  echo "status:missing:script"
  exit 0
fi

if ! grep -qE '^## 场景 [0-9]+[:：]' "$SCRIPT_FILE"; then
  echo "status:missing:scenes"
  exit 0
fi

TMPDIR_RUN=$(mktemp -d)
trap "rm -rf $TMPDIR_RUN" EXIT

awk -v tmpdir="$TMPDIR_RUN" '
  /^##[[:space:]]/ {
    if (in_scene) close(f)
    in_scene=0
  }
  /^## 场景 [0-9]+[:：]/ {
    n++
    in_scene=1
    f = tmpdir "/scene-" n ".md"
    print > f
    next
  }
  in_scene { print >> f }
' "$SCRIPT_FILE"

TOTAL_ACTUAL=0
TOTAL_LOWER=0
TOTAL_UPPER=0
SCENE_COUNT=0
SCENES_WARN=0
SCENES_OK=0
SCENES_MISSING=0

for f in "$TMPDIR_RUN"/scene-*.md; do
  [ -f "$f" ] || continue
  SCENE_COUNT=$((SCENE_COUNT + 1))
  H2=$(head -1 "$f")
  N=$(echo "$H2" | grep -oE '场景 [0-9]+' | grep -oE '[0-9]+')
  TITLE=$(echo "$H2" | sed -E 's/^## 场景 [0-9]+[:：][[:space:]]*//')
  DURATION=$(grep -oE '(\*\*)?目标时长[:：]?(\*\*)?[[:space:]]*[:：]?[[:space:]]*[0-9]+[[:space:]]*(s|秒)' "$f" \
    | grep -oE '[0-9]+[[:space:]]*(s|秒)' | grep -oE '[0-9]+' | head -1)
  if [ -z "$DURATION" ]; then
    echo "scene:${N}:title=${TITLE}:duration=0:actual=0:expected_lower=0:expected_upper=0:status=missing:duration"
    SCENES_MISSING=$((SCENES_MISSING + 1))
    continue
  fi
  ACTUAL=$(bash "$SCRIPT_DIR/word-count.sh" "$f" 2>/dev/null)
  [ -z "$ACTUAL" ] && ACTUAL=0
  LOWER=$((DURATION * 8))
  UPPER=$((DURATION * 104 / 10))
  if [ "$ACTUAL" -ge "$LOWER" ] && [ "$ACTUAL" -le "$UPPER" ]; then
    STATUS="ok"
    SCENES_OK=$((SCENES_OK + 1))
  else
    STATUS="warn"
    SCENES_WARN=$((SCENES_WARN + 1))
  fi
  TOTAL_ACTUAL=$((TOTAL_ACTUAL + ACTUAL))
  TOTAL_LOWER=$((TOTAL_LOWER + LOWER))
  TOTAL_UPPER=$((TOTAL_UPPER + UPPER))
  echo "scene:${N}:title=${TITLE}:duration=${DURATION}:actual=${ACTUAL}:expected_lower=${LOWER}:expected_upper=${UPPER}:status=${STATUS}"
done

if [ "$SCENES_MISSING" -gt 0 ]; then
  SUMMARY_STATUS="missing"
elif [ "$SCENES_WARN" -gt 0 ]; then
  SUMMARY_STATUS="warn"
else
  SUMMARY_STATUS="ok"
fi

echo "summary:total_actual=${TOTAL_ACTUAL}:total_expected_lower=${TOTAL_LOWER}:total_expected_upper=${TOTAL_UPPER}:scene_count=${SCENE_COUNT}:scenes_warn=${SCENES_WARN}:scenes_ok=${SCENES_OK}:scenes_missing=${SCENES_MISSING}:status=${SUMMARY_STATUS}"
