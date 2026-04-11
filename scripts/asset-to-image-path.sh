#!/usr/bin/env bash
# Convert asset .md file paths to corresponding image .png paths.
# Usage: bash scripts/asset-to-image-path.sh "assets/characters/张三.md" ["assets/items/铜镜.md" ...]
# Handles relative prefixes like ../../../assets/... by stripping to assets/...
# Output: one image path per line

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/asset-to-image-path.sh path1.md [path2.md ...]"
  exit 1
fi

for path in "$@"; do
  # Strip relative prefix: anything before "assets/"
  normalized=$(echo "$path" | sed 's|.*assets/|assets/|')
  # Insert "images/" after "assets/": assets/category/name.md -> assets/images/category/name.png
  echo "$normalized" | sed 's|^assets/|assets/images/|' | sed 's|\.md$|.png|'
done
