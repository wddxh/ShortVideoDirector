#!/usr/bin/env bash
# Compute novel word count vs expected budget derived from outline scene 目标时长.
# Usage: bash scripts/novel-budget.sh <ep> [config_path]
# Output: multi-line key:value (actual / expected_lower / expected_upper / status / duration_sum / budget_per_sec)
# Exit code: always 0 (consumer parses status field to decide pass/fail)

set -u

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/novel-budget.sh <ep> [config_path]" >&2
  exit 1
fi

EP="$1"
EP_DIR="story/episodes/$EP"
OUTLINE="$EP_DIR/outline.md"
NOVEL="$EP_DIR/novel.md"

# Check inputs
if [ ! -f "$OUTLINE" ]; then
  echo "status:missing:outline"
  exit 0
fi
if [ ! -f "$NOVEL" ]; then
  echo "status:missing:novel"
  exit 0
fi

# Sum 目标时长 from outline (pattern: "- **目标时长:** Ns" or "- **目标时长：** Ns")
DURATION_SUM=$(grep -oE '\*\*目标时长[:：]\*\*[[:space:]]*[0-9]+s' "$OUTLINE" \
  | grep -oE '[0-9]+' | awk '{s+=$1} END {print s+0}')

if [ -z "$DURATION_SUM" ] || [ "$DURATION_SUM" -eq 0 ]; then
  echo "status:missing:duration"
  exit 0
fi

# Compute expected range
EXPECTED_LOWER=$((DURATION_SUM * 7))
EXPECTED_UPPER=$((DURATION_SUM * 13))
FAIL_LOWER=$((DURATION_SUM * 6))
FAIL_UPPER=$((DURATION_SUM * 14))

# Actual word count
ACTUAL=$(bash scripts/word-count.sh "$NOVEL" 2>/dev/null)
if [ -z "$ACTUAL" ]; then
  ACTUAL=0
fi

# Decide status
if [ "$ACTUAL" -ge "$EXPECTED_LOWER" ] && [ "$ACTUAL" -le "$EXPECTED_UPPER" ]; then
  STATUS="ok"
elif [ "$ACTUAL" -ge "$FAIL_LOWER" ] && [ "$ACTUAL" -le "$FAIL_UPPER" ]; then
  STATUS="warn"
else
  STATUS="fail"
fi

echo "actual:$ACTUAL"
echo "expected_lower:$EXPECTED_LOWER"
echo "expected_upper:$EXPECTED_UPPER"
echo "status:$STATUS"
echo "duration_sum:$DURATION_SUM"
echo "budget_per_sec:10"
