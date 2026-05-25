#!/usr/bin/env bash
# Compute script.md per-scene word count vs expected budget derived from per-scene 目标时长.
# Usage: bash scripts/script-budget.sh <ep> [config_path]
# Output:
#   scene:N:title=...:duration=Ds:actual=X:expected_lower=L:expected_upper=U:status=ok/fail/missing:duration
#   summary:total_actual=...:total_expected_lower=...:total_expected_upper=...:scene_count=...:scenes_fail=...:scenes_ok=...:status=ok/fail
# Exit code: always 0 (consumer parses status to decide)

set -u

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
  /^## 场景 [0-9]+[:：]/ {
    if (n > 0) close(f)
    n++
    f = tmpdir "/scene-" n ".md"
    print > f
    next
  }
  n > 0 { print >> f }
' "$SCRIPT_FILE"

TOTAL_ACTUAL=0
TOTAL_LOWER=0
TOTAL_UPPER=0
SCENE_COUNT=0
SCENES_FAIL=0
SCENES_OK=0

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
    SCENES_FAIL=$((SCENES_FAIL + 1))
    continue
  fi
  ACTUAL=$(bash scripts/word-count.sh "$f" 2>/dev/null)
  [ -z "$ACTUAL" ] && ACTUAL=0
  LOWER=$((DURATION * 8))
  UPPER=$((DURATION * 104 / 10))
  if [ "$ACTUAL" -ge "$LOWER" ] && [ "$ACTUAL" -le "$UPPER" ]; then
    STATUS="ok"
    SCENES_OK=$((SCENES_OK + 1))
  else
    STATUS="fail"
    SCENES_FAIL=$((SCENES_FAIL + 1))
  fi
  TOTAL_ACTUAL=$((TOTAL_ACTUAL + ACTUAL))
  TOTAL_LOWER=$((TOTAL_LOWER + LOWER))
  TOTAL_UPPER=$((TOTAL_UPPER + UPPER))
  echo "scene:${N}:title=${TITLE}:duration=${DURATION}:actual=${ACTUAL}:expected_lower=${LOWER}:expected_upper=${UPPER}:status=${STATUS}"
done

if [ "$SCENES_FAIL" -eq 0 ]; then
  SUMMARY_STATUS="ok"
else
  SUMMARY_STATUS="fail"
fi

echo "summary:total_actual=${TOTAL_ACTUAL}:total_expected_lower=${TOTAL_LOWER}:total_expected_upper=${TOTAL_UPPER}:scene_count=${SCENE_COUNT}:scenes_fail=${SCENES_FAIL}:scenes_ok=${SCENES_OK}:status=${SUMMARY_STATUS}"
