#!/usr/bin/env bash
# scripts/detect-mode.sh — 检测当前项目 mode (series | short)
#
# 从指定配置读取显式 mode；默认 config.md，规划文件不决定模式。
#
# 输出: 'series' 或 'short'
# 退出码: 0=success, 1=unknown mode

set -euo pipefail

MODE=""
CONFIG=${1:-config.md}
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if [ -f "$CONFIG" ]; then
  if grep -q '^- mode:' "$CONFIG"; then
    MODE=$(bash "$SCRIPT_DIR/read-config.sh" mode "$CONFIG" || true)
  else
    # Preserve the existing bare mode field format.
    MODE=$(grep -E '^mode:[[:space:]]*' "$CONFIG" 2>/dev/null \
         | head -n1 \
         | sed -E 's/^mode:[[:space:]]*//' \
         | tr -d '[:space:]' || true)
  fi
fi

case "$MODE" in
  series|short) echo "$MODE"; exit 0 ;;
  *) echo "unknown mode: $MODE" >&2; exit 1 ;;
esac
