#!/usr/bin/env bash
# scripts/parse-storyboard-kf.sh — 解析 storyboard.md 中的 [KF-id] 内联引用
# 用法: bash scripts/parse-storyboard-kf.sh <storyboard.md>
# 输出: 每行一条 TSV 记录 `KF-id<TAB>position<TAB>shot_number`
#       position ∈ {首帧, 尾帧, 参考}
#       同一 (KF-id, shot_number) 去重；多 shot 引用同一 KF 时按出现顺序保留全部
# 退出码: 0=成功 (即使 0 条引用), 1=参数错或文件不存在, 2=解析失败（KF 缺位置语义）

set -euo pipefail

usage() {
  echo "Usage: $0 <storyboard.md>" >&2
  exit 1
}

[ "$#" -eq 1 ] || usage
FILE="$1"
[ -f "$FILE" ] || { echo "FAIL file not found: $FILE" >&2; exit 1; }

# 用 awk 维护当前 shot 编号 + 扫描 prose 行中的 KF 引用
# shot 起始: `### shot N`
# KF 内联标记格式: `画面首帧是 [KF-id]` / `画面尾帧是 [KF-id]` / `画面参考 [KF-id]`
# 错误格式: 仅 `[KF-id]` 不带位置语义 → exit 2

awk '
  BEGIN { shot=0; bad=0 }
  /^### shot[[:space:]]+[0-9]+/ {
    match($0, /shot[[:space:]]+([0-9]+)/, m)
    shot = m[1]
    in_prose = 0
    next
  }
  /^\*\*画面与声音描述：\*\*/ { in_prose = 1; next }
  /^### / { in_prose = 0 }
  in_prose == 1 {
    line = $0
    # 先抽出所有带位置语义的引用并记录 + 从行中删除
    while (match(line, /(画面首帧是|画面尾帧是|画面参考)[[:space:]]*\[(KF-[A-Za-z0-9_-]+)\]/, mm)) {
      pos = mm[1]
      kf = mm[2]
      if (pos == "画面首帧是") p = "首帧"
      else if (pos == "画面尾帧是") p = "尾帧"
      else p = "参考"
      print kf "\t" p "\t" shot
      line = substr(line, 1, RSTART-1) substr(line, RSTART+RLENGTH)
    }
    # 剩余行如果还残留 [KF-xxx] 就是无位置语义引用 → 报错
    if (match(line, /\[KF-[A-Za-z0-9_-]+\]/)) {
      printf "PARSE_ERROR shot %s: KF reference without position marker (画面首帧是/画面尾帧是/画面参考): %s\n", shot, substr(line, RSTART, RLENGTH) > "/dev/stderr"
      bad = 1
    }
  }
  END { exit (bad ? 2 : 0) }
' "$FILE"
