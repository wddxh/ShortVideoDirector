#!/usr/bin/env bash
# 一次性源 skill 迁移到 ${CLAUDE_PLUGIN_ROOT}
# 用法: bash scripts/migrate-pluginroot.sh [--dry-run]
set -euo pipefail

DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

mapfile -t FILES < <(find skills agents -name '*.md' -type f 2>/dev/null)

# 三类需迁移的 pattern (OR 起来检测)
PATTERN='\$SVD_PLUGIN_DIR/|\bbash scripts/|`skills/[^`]+\.md`'

CHANGED=0
for f in "${FILES[@]}"; do
  if grep -qE "$PATTERN" "$f"; then
    CHANGED=$((CHANGED+1))
    if [[ $DRY -eq 1 ]]; then
      echo "WOULD CHANGE: $f"
    else
      sed -i -E \
        -e 's|\$SVD_PLUGIN_DIR/|${CLAUDE_PLUGIN_ROOT}/|g' \
        -e 's|(\bbash )scripts/|\1${CLAUDE_PLUGIN_ROOT}/scripts/|g' \
        -e 's|`skills/([^`]+\.md)`|`${CLAUDE_PLUGIN_ROOT}/skills/\1`|g' \
        "$f"
      echo "CHANGED: $f"
    fi
  fi
done

echo "Total: $CHANGED files"
