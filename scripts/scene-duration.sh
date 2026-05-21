#!/usr/bin/env bash
# scripts/scene-duration.sh — 校验 script.md 的场景时长分布
# 用法:
#   scripts/scene-duration.sh <script.md> --target <N>
#   scripts/scene-duration.sh <script.md> --target-min <M> --target-max <X>
# 输出: PASS (sum=Xs) 或 FAIL (sum=Xs, exceeds max <max> | below min <min>)
# 退出码: 0=PASS, 1=FAIL, 2=参数错误

set -euo pipefail

usage() {
  echo "Usage: $0 <script.md> --target <N>" >&2
  echo "       $0 <script.md> --target-min <M> --target-max <X>" >&2
  exit 2
}

[ "$#" -ge 3 ] || usage

FILE="$1"; shift
TARGET=""; TARGET_MIN=""; TARGET_MAX=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --target-min) TARGET_MIN="$2"; shift 2 ;;
    --target-max) TARGET_MAX="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[ -f "$FILE" ] || { echo "FAIL (file not found: $FILE)"; exit 1; }

# 提取所有 "目标时长: <N>s" 形式的秒数并累加
SUM=$( ( grep -oE '目标时长:[[:space:]]*[0-9]+s' "$FILE" 2>/dev/null || true ) \
        | ( grep -oE '[0-9]+' || true ) \
        | awk 'BEGIN{s=0} {s+=$1} END{print s+0}' )

if [ -n "$TARGET" ]; then
  MIN=$(awk "BEGIN { printf \"%.0f\", $TARGET * 0.9 }")
  MAX=$(awk "BEGIN { printf \"%.0f\", $TARGET * 1.1 }")
elif [ -n "$TARGET_MIN" ] && [ -n "$TARGET_MAX" ]; then
  MIN="$TARGET_MIN"; MAX="$TARGET_MAX"
else
  usage
fi

if [ "$SUM" -lt "$MIN" ]; then
  echo "FAIL (sum=${SUM}s, below min ${MIN})"
  exit 1
elif [ "$SUM" -gt "$MAX" ]; then
  echo "FAIL (sum=${SUM}s, exceeds max ${MAX})"
  exit 1
else
  echo "PASS (sum=${SUM}s, range [${MIN}, ${MAX}])"
  exit 0
fi
