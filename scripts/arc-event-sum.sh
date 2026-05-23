#!/usr/bin/env bash
# scripts/arc-event-sum.sh — 校验 arc.md 节点 bullet schema + sum ≤ 预算
# 用法: bash scripts/arc-event-sum.sh <arc.md>
# 输出: 每节点 PASS/WARN/FAIL 信息
# 退出码: 0=PASS (可含 WARN), 1=FAIL

set -euo pipefail

usage() {
  echo "Usage: bash scripts/arc-event-sum.sh <arc.md>" >&2
  exit 1
}

[ "$#" -eq 1 ] || usage
FILE="$1"
[ -f "$FILE" ] || { echo "FAIL (file not found: $FILE)"; exit 1; }

awk '
function fail(msg) { printf "FAIL: %s\n", msg; status = 1 }
function warn(msg) { printf "WARN: %s\n", msg }
function pass(msg) { printf "PASS: %s\n", msg }

function check_node(   i, line, sec, kind, sum, opt_sum, m) {
  if (budget < 0) {
    fail(node_name ": 节点 header 缺 节点预算 ~Zs 字段")
    return
  }
  sum = 0; opt_sum = 0
  for (i = 1; i <= bcount; i++) {
    line = bullets[i]
    if (match(line, /\(~([0-9]+)s,[[:space:]]*(必需|可选)\)/, m)) {
      sec = m[1] + 0
      kind = m[2]
      sum += sec
      if (kind == "可选") opt_sum += sec
    } else {
      fail(node_name ": bullet schema 违规 (需 (~Ns, 必需|可选)): " line)
      return
    }
  }
  if (sum > budget) {
    fail(node_name ": sum=" sum "s > 节点预算 " budget "s")
    return
  }
  if (budget > 0 && opt_sum * 100 / budget > 40) {
    warn(node_name ": 可选 bullet sum=" opt_sum "s 占预算 " budget "s 的 " int(opt_sum*100/budget) "%, 超 40% (骨架不清晰)")
  }
  pass(node_name ": sum=" sum "s ≤ 预算 " budget "s")
}

BEGIN { status = 0; node_idx = 0; budget = -1; bcount = 0; in_events = 0 }

/^### 节点/ {
  if (node_idx > 0) check_node()
  node_idx++
  node_header = $0
  node_name = $0
  in_events = 0
  delete bullets
  bcount = 0
  if (match(node_header, /节点预算[[:space:]]*~([0-9]+)s/, m)) {
    budget = m[1] + 0
  } else {
    budget = -1
  }
  next
}

/^- 核心事件:/ { in_events = 1; next }
/^- 推进目标:/ { in_events = 0; next }
/^- 关键转折:/ { in_events = 0; next }
/^### / { in_events = 0 }

in_events && /^[[:space:]]+-[[:space:]]/ {
  bullets[++bcount] = $0
}

END { if (node_idx > 0) check_node(); exit status }
' "$FILE"
