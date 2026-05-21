#!/usr/bin/env bash
# scripts/detect-mode.sh — 检测当前项目 mode (series | short)
#
# 优先级:
#   1. config.md 的 `mode:` 字段 (值: 'series' | 'short')
#   2. Fallback: story/arc.md 存在 → series；否则 → short
#
# 输出: 'series' 或 'short'
# 退出码: 0=success, 1=unknown mode

set -euo pipefail

MODE=""

if [ -f config.md ]; then
  MODE=$(grep -E '^mode:[[:space:]]*' config.md 2>/dev/null \
         | head -n1 \
         | sed -E 's/^mode:[[:space:]]*//' \
         | tr -d '[:space:]' || true)
fi

if [ -z "$MODE" ]; then
  if [ -f story/arc.md ]; then
    MODE="series"
  else
    MODE="short"
  fi
fi

case "$MODE" in
  series|short) echo "$MODE"; exit 0 ;;
  *) echo "unknown mode: $MODE" >&2; exit 1 ;;
esac
