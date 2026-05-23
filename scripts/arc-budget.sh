#!/usr/bin/env bash
# scripts/arc-budget.sh — 推算 arc 节点预算秒数
# 用法: bash scripts/arc-budget.sh <ep_count>
# 输出: 节点预算秒数 (单整数, stdout)
# 退出码: 0=PASS, 1=参数错误 / config 缺字段 / config 文件不存在

set -euo pipefail

usage() {
  echo "Usage: bash scripts/arc-budget.sh <ep_count>" >&2
  exit 1
}

[ "$#" -eq 1 ] || usage

EP_COUNT="$1"

if ! [[ "$EP_COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo "ep_count must be positive integer, got: $EP_COUNT" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DURATION=$(bash "$SCRIPT_DIR/read-config.sh" "每集时长目标" 2>/dev/null || true)

if [ -z "$DURATION" ]; then
  echo "config.md 缺 '每集时长目标' 字段或 config.md 不存在" >&2
  exit 1
fi

parse_max() {
  local s="$1"
  if [[ "$s" =~ ^([0-9]+)-([0-9]+)[[:space:]]*(分钟|秒|s)$ ]]; then
    local hi="${BASH_REMATCH[2]}"
    local unit="${BASH_REMATCH[3]}"
    if [ "$unit" = "分钟" ]; then
      echo $((hi * 60))
    else
      echo "$hi"
    fi
    return 0
  fi
  if [[ "$s" =~ ^([0-9]+)[[:space:]]*(s|秒)$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$s" =~ ^([0-9]+)[[:space:]]*分钟$ ]]; then
    echo $((${BASH_REMATCH[1]} * 60))
    return 0
  fi
  return 1
}

MAX_SEC=$(parse_max "$DURATION") || {
  echo "无法解析 '每集时长目标' 值: $DURATION" >&2
  exit 1
}

echo $((EP_COUNT * MAX_SEC))
