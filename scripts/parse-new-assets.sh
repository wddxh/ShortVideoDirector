#!/usr/bin/env bash
# Parse outline.md "## 本集资产清单 → ### 新增资产" section.
# Usage: bash scripts/parse-new-assets.sh <outline_path>
# Exit: 0 = OK; 1 = missing file / section

set -e
OUTLINE="$1"
[ -z "$OUTLINE" ] && { echo "Usage: bash scripts/parse-new-assets.sh <outline>" >&2; exit 1; }
[ ! -f "$OUTLINE" ] && { echo "ERROR: outline 文件不存在: $OUTLINE" >&2; exit 1; }

SECTION=$(awk '
  /^## 本集资产清单[[:space:]]*$/ { in_section=1; next }
  in_section && /^## / { exit }
  in_section { print }
' "$OUTLINE")

[ -z "$SECTION" ] && { echo "ERROR: outline 缺『## 本集资产清单』段；请先运行 scriptwriter-script 生成本集资产清单" >&2; exit 1; }

if ! printf '%s\n' "$SECTION" | grep -q '^### 新增资产[[:space:]]*$'; then
  echo "ERROR: 『本集资产清单』段缺『### 新增资产』子段；请先运行 scriptwriter-script 重新生成" >&2
  exit 1
fi

SUBSEC=$(printf '%s\n' "$SECTION" | awk '
  /^### 新增资产[[:space:]]*$/ { in_sub=1; next }
  in_sub && /^### / { exit }
  in_sub { print }
')

printf '%s\n' "$SUBSEC" | awk -F': *' '
  /^- (characters|locations|items|buildings):/ {
    type = $1; sub(/^- /, "", type)
    ids = $2
    if (ids == "") next
    n = split(ids, arr, /, */)
    for (i = 1; i <= n; i++) {
      id = arr[i]
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", id)
      if (id != "") print "assets/" type "/" id ".md"
    }
  }
'
